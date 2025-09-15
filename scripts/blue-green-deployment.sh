#!/bin/bash

# Blue-Green Deployment Script for Modal to Speechmatics Migration
# This script handles the deployment of the new Speechmatics direct integration
# while maintaining the ability to rollback to Modal if needed

set -e

# Configuration
DEPLOYMENT_ID="bg-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="deployments/blue-green-${DEPLOYMENT_ID}.log"
GREEN_ENV_URL="${GREEN_ENV_URL:-https://staging.example.com}"
BLUE_ENV_URL="${BLUE_ENV_URL:-https://example.com}"
HEALTH_CHECK_TIMEOUT=300 # 5 minutes
TRAFFIC_SWITCH_DELAY=30  # 30 seconds

# Create logs directory
mkdir -p deployments

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [BLUE-GREEN] $1" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "📋 Checking deployment prerequisites..."
    
    # Check required environment variables
    if [ -z "$EXPO_PUBLIC_SPEECHMATICS_API_KEY" ]; then
        log "❌ EXPO_PUBLIC_SPEECHMATICS_API_KEY is required"
        exit 1
    fi
    
    if [ -z "$EXPO_PUBLIC_LIVEKIT_URL" ]; then
        log "❌ EXPO_PUBLIC_LIVEKIT_URL is required"
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        log "❌ jq is required but not installed"
        exit 1
    fi
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log "❌ curl is required but not installed"
        exit 1
    fi
    
    log "✅ Prerequisites check passed"
}

deploy_green_environment() {
    log "🟢 Deploying Green environment (Speechmatics Direct)..."
    
    # Set environment variables for green deployment
    export EXPO_PUBLIC_FEATURE_FLAG_SPEECHMATICS_DIRECT=true
    export EXPO_PUBLIC_FEATURE_FLAG_MODAL_FALLBACK=true
    export EXPO_PUBLIC_GREEN_DEPLOYMENT=true
    export EXPO_PUBLIC_DEPLOYMENT_ID="$DEPLOYMENT_ID"
    
    # Build green environment
    log "🏗️  Building green environment..."
    npm run build:production || {
        log "❌ Green environment build failed"
        exit 1
    }
    
    # Deploy to staging/green environment
    log "📦 Deploying to green environment..."
    
    # Create green-specific configuration
    cat > dist/green-config.json << EOF
{
    "deploymentId": "$DEPLOYMENT_ID",
    "environment": "green",
    "speechService": "speechmatics-direct",
    "features": {
        "speechmaticsDirectEnabled": true,
        "modalFallbackEnabled": true
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
    
    # Here you would deploy to your green environment
    # This example assumes GitHub Pages, but adapt for your infrastructure
    if [ "$CI" = "true" ]; then
        # CI deployment
        log "🚀 Deploying via CI/CD pipeline..."
        # GitHub Actions will handle the actual deployment
    else {
        # Local deployment
        log "🚀 Deploying to green environment (staging)..."
        # Add your deployment commands here
        # Example: rsync, scp, aws s3 sync, etc.
    fi
    
    log "✅ Green environment deployed"
}

health_check_green() {
    log "🔍 Performing health checks on Green environment..."
    
    local attempts=0
    local max_attempts=20
    local wait_time=15
    
    while [ $attempts -lt $max_attempts ]; do
        log "🏥 Health check attempt $((attempts + 1))/$max_attempts..."
        
        # Check if green environment is responding
        if curl -f -s "$GREEN_ENV_URL/api/health" -m 10 > /dev/null; then
            log "✅ Green environment health check passed"
            
            # Test Speechmatics integration
            local token_response=$(curl -s -X POST "$GREEN_ENV_URL/api/speechmatics-token" \
                -H "Content-Type: application/json" \
                -d '{"type":"speechmatics","transcriptionConfig":{"language":"en"}}' \
                -m 10)
            
            if echo "$token_response" | jq -e '.token' > /dev/null 2>&1; then
                log "✅ Speechmatics integration test passed"
                return 0
            else
                log "⚠️  Speechmatics integration test failed: $token_response"
            fi
        else
            log "⚠️  Green environment health check failed"
        fi
        
        attempts=$((attempts + 1))
        if [ $attempts -lt $max_attempts ]; then
            log "⏳ Waiting ${wait_time} seconds before next attempt..."
            sleep $wait_time
        fi
    done
    
    log "❌ Green environment health checks failed after $max_attempts attempts"
    return 1
}

performance_test_green() {
    log "⚡ Running performance tests on Green environment..."
    
    local total_requests=10
    local success_count=0
    local total_time=0
    
    for i in $(seq 1 $total_requests); do
        local start_time=$(date +%s%N)
        
        if curl -f -s "$GREEN_ENV_URL/api/health" -m 5 > /dev/null; then
            local end_time=$(date +%s%N)
            local request_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
            total_time=$((total_time + request_time))
            success_count=$((success_count + 1))
            
            log "📊 Request $i: ${request_time}ms"
        else
            log "❌ Request $i: Failed"
        fi
        
        sleep 0.5
    done
    
    if [ $success_count -eq 0 ]; then
        log "❌ All performance test requests failed"
        return 1
    fi
    
    local avg_response_time=$((total_time / success_count))
    local success_rate=$(( (success_count * 100) / total_requests ))
    
    log "📈 Performance test results:"
    log "   Success rate: ${success_rate}%"
    log "   Average response time: ${avg_response_time}ms"
    log "   Successful requests: ${success_count}/${total_requests}"
    
    # Check if performance is acceptable
    if [ $success_rate -lt 95 ]; then
        log "❌ Success rate below threshold (95%)"
        return 1
    fi
    
    if [ $avg_response_time -gt 2000 ]; then
        log "❌ Average response time above threshold (2000ms)"
        return 1
    fi
    
    log "✅ Performance tests passed"
    return 0
}

canary_deployment() {
    local canary_percentage=${1:-10}
    log "🐤 Starting canary deployment (${canary_percentage}% traffic to Green)..."
    
    # Create traffic routing configuration
    cat > dist/traffic-config.json << EOF
{
    "deploymentId": "$DEPLOYMENT_ID",
    "routingStrategy": "canary",
    "trafficSplit": {
        "blue": $((100 - canary_percentage)),
        "green": $canary_percentage
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
    
    log "📊 Traffic split: ${canary_percentage}% Green, $((100 - canary_percentage))% Blue"
    
    # Monitor canary deployment
    log "📈 Monitoring canary deployment for 5 minutes..."
    local monitoring_duration=300 # 5 minutes
    local check_interval=30 # 30 seconds
    local checks=$((monitoring_duration / check_interval))
    
    for i in $(seq 1 $checks); do
        log "🔍 Canary monitoring check $i/$checks..."
        
        # Check green environment health
        if ! curl -f -s "$GREEN_ENV_URL/api/health" -m 10 > /dev/null; then
            log "❌ Green environment health check failed during canary"
            return 1
        fi
        
        # Check for error rate increase
        local error_rate=$(curl -s "$GREEN_ENV_URL/api/health" | jq -r '.errorRate // 0' 2>/dev/null || echo "0")
        if (( $(echo "$error_rate > 5.0" | bc -l 2>/dev/null || echo "0") )); then
            log "❌ High error rate detected: ${error_rate}%"
            return 1
        fi
        
        log "✅ Canary check $i passed (error rate: ${error_rate}%)"
        
        if [ $i -lt $checks ]; then
            sleep $check_interval
        fi
    done
    
    log "✅ Canary deployment monitoring completed successfully"
    return 0
}

switch_traffic_to_green() {
    log "🔀 Switching traffic from Blue to Green..."
    
    # Create backup of current blue configuration
    if [ -f "dist/current-config.json" ]; then
        cp dist/current-config.json "dist/blue-backup-${DEPLOYMENT_ID}.json"
        log "💾 Blue configuration backed up"
    fi
    
    # Update traffic routing to 100% green
    cat > dist/traffic-config.json << EOF
{
    "deploymentId": "$DEPLOYMENT_ID",
    "routingStrategy": "full-green",
    "trafficSplit": {
        "blue": 0,
        "green": 100
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "rollbackConfig": {
        "enabled": true,
        "blueBackup": "blue-backup-${DEPLOYMENT_ID}.json"
    }
}
EOF
    
    # Update current configuration
    cp dist/green-config.json dist/current-config.json
    
    log "🎯 Traffic switched to Green environment (100%)"
    
    # Wait for traffic switch to propagate
    log "⏳ Waiting ${TRAFFIC_SWITCH_DELAY} seconds for traffic switch to propagate..."
    sleep $TRAFFIC_SWITCH_DELAY
    
    # Verify traffic switch
    log "🔍 Verifying traffic switch..."
    if curl -f -s "$BLUE_ENV_URL/current-config.json" | jq -e '.environment == "green"' > /dev/null 2>&1; then
        log "✅ Traffic switch verified"
        return 0
    else
        log "⚠️  Traffic switch verification failed"
        return 1
    fi
}

post_deployment_monitoring() {
    log "📊 Starting post-deployment monitoring..."
    
    local monitoring_duration=600 # 10 minutes
    local check_interval=60 # 1 minute
    local checks=$((monitoring_duration / check_interval))
    
    for i in $(seq 1 $checks); do
        log "📈 Post-deployment check $i/$checks..."
        
        # Health check
        if ! curl -f -s "$BLUE_ENV_URL/api/health" -m 10 > /dev/null; then
            log "❌ Post-deployment health check failed"
            return 1
        fi
        
        # Performance check
        local start_time=$(date +%s%N)
        curl -f -s "$BLUE_ENV_URL/api/health" -m 5 > /dev/null
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))
        
        log "📊 Response time: ${response_time}ms"
        
        if [ $response_time -gt 3000 ]; then
            log "⚠️  Response time above threshold: ${response_time}ms"
        fi
        
        # Test Speechmatics functionality
        local token_test=$(curl -s -X POST "$BLUE_ENV_URL/api/speechmatics-token" \
            -H "Content-Type: application/json" \
            -d '{"type":"speechmatics","transcriptionConfig":{"language":"en"}}' \
            -m 10)
        
        if echo "$token_test" | jq -e '.token' > /dev/null 2>&1; then
            log "✅ Speechmatics integration working"
        else
            log "⚠️  Speechmatics integration issue: $token_test"
        fi
        
        if [ $i -lt $checks ]; then
            sleep $check_interval
        fi
    done
    
    log "✅ Post-deployment monitoring completed"
    return 0
}

cleanup_blue_environment() {
    log "🧹 Cleaning up Blue environment..."
    
    # Remove old blue artifacts (but keep backups)
    if [ -d "dist/blue-artifacts" ]; then
        rm -rf dist/blue-artifacts
        log "🗑️  Blue artifacts cleaned up"
    fi
    
    # Archive deployment logs
    if [ -f "$LOG_FILE" ]; then
        gzip "$LOG_FILE"
        log "📦 Deployment log archived: ${LOG_FILE}.gz"
    fi
    
    log "✅ Blue environment cleanup completed"
}

rollback_to_blue() {
    log "🚨 ROLLBACK: Switching back to Blue environment..."
    
    # Restore blue configuration
    if [ -f "dist/blue-backup-${DEPLOYMENT_ID}.json" ]; then
        cp "dist/blue-backup-${DEPLOYMENT_ID}.json" dist/current-config.json
        log "🔄 Blue configuration restored"
    else
        log "⚠️  No blue backup found, creating default blue config..."
        cat > dist/current-config.json << EOF
{
    "deploymentId": "rollback-$(date +%s)",
    "environment": "blue",
    "speechService": "modal",
    "features": {
        "speechmaticsDirectEnabled": false,
        "modalFallbackEnabled": true
    },
    "rollback": true,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF
    fi
    
    # Update traffic routing back to blue
    cat > dist/traffic-config.json << EOF
{
    "deploymentId": "rollback-${DEPLOYMENT_ID}",
    "routingStrategy": "full-blue",
    "trafficSplit": {
        "blue": 100,
        "green": 0
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "rollbackReason": "Manual rollback or deployment failure"
}
EOF
    
    log "🔄 Traffic switched back to Blue environment"
    
    # Verify rollback
    sleep $TRAFFIC_SWITCH_DELAY
    if curl -f -s "$BLUE_ENV_URL/api/health" -m 10 > /dev/null; then
        log "✅ Rollback completed successfully"
        return 0
    else
        log "❌ Rollback verification failed"
        return 1
    fi
}

send_deployment_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        local emoji="✅"
        
        if [ "$status" != "success" ]; then
            color="danger"
            emoji="❌"
        fi
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{
                \"text\": \"${emoji} Blue-Green Deployment ${status}\",
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"fields\": [
                        {\"title\": \"Deployment ID\", \"value\": \"${DEPLOYMENT_ID}\", \"short\": true},
                        {\"title\": \"Environment\", \"value\": \"Production\", \"short\": true},
                        {\"title\": \"Message\", \"value\": \"${message}\", \"short\": false}
                    ]
                }]
            }" > /dev/null 2>&1
    fi
}

# Main deployment function
main() {
    local strategy=${1:-full} # full, canary, or rollback
    local canary_percentage=${2:-10}
    
    log "🚀 Starting Blue-Green deployment: $DEPLOYMENT_ID"
    log "📋 Strategy: $strategy"
    
    case $strategy in
        "rollback")
            log "🔄 Executing rollback procedure..."
            if rollback_to_blue; then
                send_deployment_notification "success" "Rollback to Blue environment completed"
                log "✅ Rollback completed successfully"
            else
                send_deployment_notification "failed" "Rollback failed"
                log "❌ Rollback failed"
                exit 1
            fi
            ;;
            
        "canary")
            log "🐤 Executing canary deployment..."
            
            check_prerequisites
            deploy_green_environment
            
            if health_check_green && performance_test_green; then
                if canary_deployment $canary_percentage; then
                    send_deployment_notification "success" "Canary deployment ($canary_percentage%) completed successfully"
                    log "✅ Canary deployment completed successfully"
                else
                    log "❌ Canary deployment failed, initiating rollback..."
                    rollback_to_blue
                    send_deployment_notification "failed" "Canary deployment failed, rolled back to Blue"
                    exit 1
                fi
            else
                log "❌ Green environment not ready, deployment aborted"
                send_deployment_notification "failed" "Green environment health checks failed"
                exit 1
            fi
            ;;
            
        "full"|*)
            log "🎯 Executing full Blue-Green deployment..."
            
            check_prerequisites
            deploy_green_environment
            
            if health_check_green && performance_test_green; then
                if canary_deployment 10; then # Start with 10% canary
                    if switch_traffic_to_green; then
                        if post_deployment_monitoring; then
                            cleanup_blue_environment
                            send_deployment_notification "success" "Full Blue-Green deployment completed successfully"
                            log "🎉 Blue-Green deployment completed successfully!"
                        else
                            log "❌ Post-deployment monitoring failed, initiating rollback..."
                            rollback_to_blue
                            send_deployment_notification "failed" "Post-deployment monitoring failed, rolled back"
                            exit 1
                        fi
                    else
                        log "❌ Traffic switch failed, initiating rollback..."
                        rollback_to_blue
                        send_deployment_notification "failed" "Traffic switch failed, rolled back"
                        exit 1
                    fi
                else
                    log "❌ Canary phase failed, deployment aborted"
                    send_deployment_notification "failed" "Canary deployment failed"
                    exit 1
                fi
            else
                log "❌ Green environment not ready, deployment aborted"
                send_deployment_notification "failed" "Green environment health checks failed"
                exit 1
            fi
            ;;
    esac
    
    log "📊 Deployment summary saved to: $LOG_FILE"
    log "🎯 Deployment ID: $DEPLOYMENT_ID"
}

# Handle script termination
trap 'log "🛑 Deployment interrupted, initiating emergency rollback..."; rollback_to_blue; exit 1' INT TERM

# Execute main function with all arguments
main "$@"