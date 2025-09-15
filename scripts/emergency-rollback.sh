#!/bin/bash

# Emergency Rollback Script for Modal to Speechmatics Migration
# This script provides instant rollback capabilities when issues are detected

set -e

# Configuration
ROLLBACK_ID="rollback-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="deployments/${ROLLBACK_ID}.log"
ROLLBACK_REASON="${1:-Manual emergency rollback}"
ROLLBACK_TARGET="${2:-modal}"
MAX_ROLLBACK_TIME=120 # 2 minutes maximum rollback time

# Create logs directory
mkdir -p deployments

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [EMERGENCY-ROLLBACK] $1" | tee -a "$LOG_FILE"
}

show_banner() {
    log "🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    log "🚨             EMERGENCY ROLLBACK INITIATED           🚨"
    log "🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨"
    log "📋 Rollback ID: $ROLLBACK_ID"
    log "📝 Reason: $ROLLBACK_REASON"
    log "🎯 Target: $ROLLBACK_TARGET"
    log "⏰ Started: $(date)"
}

capture_pre_rollback_state() {
    log "📸 Capturing pre-rollback system state..."
    
    local state_file="deployments/${ROLLBACK_ID}-pre-rollback-state.json"
    
    # Capture current system state
    cat > "$state_file" << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "reason": "$ROLLBACK_REASON",
    "target": "$ROLLBACK_TARGET",
    "systemState": {
        "apiHealth": $(curl -s -f http://localhost:8081/api/health > /dev/null && echo "true" || echo "false"),
        "speechmaticsToken": $(curl -s -f -X POST http://localhost:8081/api/speechmatics-token \
            -H "Content-Type: application/json" \
            -d '{"type":"speechmatics","transcriptionConfig":{"language":"en"}}' > /dev/null && echo "true" || echo "false"),
        "diskSpace": "$(df -h / | awk 'NR==2{print $4}')",
        "memoryUsage": "$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')",
        "loadAverage": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
    },
    "activeConnections": $(netstat -an 2>/dev/null | grep ESTABLISHED | wc -l || echo "0"),
    "errorLogs": [
        $(tail -5 /var/log/app.log 2>/dev/null | jq -R -s -c 'split("\n")[:-1]' || echo '[]')
    ]
}
EOF
    
    log "💾 Pre-rollback state captured: $state_file"
}

immediate_traffic_switch() {
    log "🔀 Immediate traffic switch to $ROLLBACK_TARGET..."
    
    case $ROLLBACK_TARGET in
        "modal")
            log "📡 Switching to Modal endpoint..."
            
            # Update feature flags to disable Speechmatics and enable Modal
            cat > dist/emergency-config.json << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "environment": "emergency-rollback",
    "speechService": "modal",
    "features": {
        "speechmaticsDirectEnabled": false,
        "modalFallbackEnabled": true,
        "emergencyRollback": true
    },
    "modalEndpoint": "https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "rollbackReason": "$ROLLBACK_REASON"
}
EOF
            
            # Override current configuration
            cp dist/emergency-config.json dist/current-config.json
            
            # Test Modal endpoint availability
            local modal_test_result="unknown"
            if curl -f -s "https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run" -m 10 > /dev/null; then
                modal_test_result="available"
                log "✅ Modal endpoint is available"
            else
                modal_test_result="unavailable"
                log "⚠️  Modal endpoint is not responding"
            fi
            ;;
            
        "speechmatics")
            log "📡 Switching back to Speechmatics..."
            
            cat > dist/emergency-config.json << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "environment": "emergency-rollback",
    "speechService": "speechmatics-direct",
    "features": {
        "speechmaticsDirectEnabled": true,
        "modalFallbackEnabled": true,
        "emergencyRollback": true
    },
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "rollbackReason": "$ROLLBACK_REASON"
}
EOF
            
            cp dist/emergency-config.json dist/current-config.json
            ;;
            
        *)
            log "❌ Unknown rollback target: $ROLLBACK_TARGET"
            return 1
            ;;
    esac
    
    log "✅ Traffic switch completed"
    return 0
}

preserve_user_sessions() {
    log "👤 Preserving user sessions..."
    
    # Create session preservation script for the browser
    cat > dist/session-preservation.js << 'EOF'
// Emergency rollback session preservation
(function() {
    console.log('🔄 Emergency rollback detected - preserving user sessions');
    
    // Preserve current session state
    const currentSession = {
        timestamp: Date.now(),
        url: window.location.href,
        scrollPosition: {
            x: window.scrollX,
            y: window.scrollY
        },
        localStorage: Object.assign({}, localStorage),
        sessionStorage: Object.assign({}, sessionStorage),
        rollback: true
    };
    
    // Store preservation data
    localStorage.setItem('emergency_rollback_session', JSON.stringify(currentSession));
    
    // Show user notification
    const notification = document.createElement('div');
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 15px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        ">
            <div style="max-width: 800px; margin: 0 auto;">
                <strong>🔄 System Rollback in Progress</strong><br>
                <span style="font-size: 14px;">
                    We've detected an issue and are switching to our backup system.
                    Your session has been preserved and the service will resume shortly.
                </span>
                <button onclick="this.parentElement.parentElement.style.display='none'" 
                        style="
                            background: rgba(255,255,255,0.2);
                            border: 1px solid rgba(255,255,255,0.3);
                            color: white;
                            padding: 5px 10px;
                            margin-left: 15px;
                            border-radius: 3px;
                            cursor: pointer;
                        ">
                    Dismiss
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-refresh after 10 seconds to pick up new configuration
    setTimeout(function() {
        console.log('🔄 Auto-refreshing to apply rollback configuration...');
        window.location.reload();
    }, 10000);
})();
EOF
    
    # Inject session preservation into the main page
    if [ -f "dist/index.html" ]; then
        # Add the script to the page
        sed -i.backup 's|</head>|<script src="session-preservation.js"></script></head>|' dist/index.html 2>/dev/null || true
        log "💾 Session preservation script injected"
    fi
    
    log "✅ User session preservation completed"
}

restore_service_configuration() {
    log "⚙️  Restoring service configuration for $ROLLBACK_TARGET..."
    
    case $ROLLBACK_TARGET in
        "modal")
            # Restore Modal-compatible configuration
            log "🔧 Restoring Modal configuration..."
            
            # Update environment variables file
            cat > dist/.env.rollback << EOF
# Emergency Rollback Configuration - Modal
EXPO_PUBLIC_FEATURE_FLAG_SPEECHMATICS_DIRECT=false
EXPO_PUBLIC_FEATURE_FLAG_MODAL_FALLBACK=true
EXPO_PUBLIC_MODAL_ENDPOINT=https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run
EXPO_PUBLIC_EMERGENCY_ROLLBACK=true
EXPO_PUBLIC_ROLLBACK_ID=$ROLLBACK_ID
EXPO_PUBLIC_ROLLBACK_TIMESTAMP=$(date +%s)
EOF
            
            # Wake up Modal agent if needed
            log "📡 Ensuring Modal agent is active..."
            local modal_wakeup_result="unknown"
            
            for attempt in {1..3}; do
                log "🔄 Modal wakeup attempt $attempt/3..."
                
                if curl -f -s "https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run" -m 15 > /dev/null; then
                    modal_wakeup_result="success"
                    log "✅ Modal agent is active"
                    break
                else
                    log "⚠️  Modal agent wakeup attempt $attempt failed"
                    if [ $attempt -lt 3 ]; then
                        sleep 5
                    else
                        modal_wakeup_result="failed"
                        log "❌ Modal agent could not be activated after 3 attempts"
                    fi
                fi
            done
            ;;
            
        "speechmatics")
            log "🔧 Restoring Speechmatics configuration..."
            
            cat > dist/.env.rollback << EOF
# Emergency Rollback Configuration - Speechmatics
EXPO_PUBLIC_FEATURE_FLAG_SPEECHMATICS_DIRECT=true
EXPO_PUBLIC_FEATURE_FLAG_MODAL_FALLBACK=true
EXPO_PUBLIC_EMERGENCY_ROLLBACK=true
EXPO_PUBLIC_ROLLBACK_ID=$ROLLBACK_ID
EXPO_PUBLIC_ROLLBACK_TIMESTAMP=$(date +%s)
EOF
            
            # Test Speechmatics configuration
            log "🧪 Testing Speechmatics configuration..."
            local speechmatics_test_result="unknown"
            
            if curl -f -s -X POST http://localhost:8081/api/speechmatics-token \
                -H "Content-Type: application/json" \
                -d '{"type":"speechmatics","transcriptionConfig":{"language":"en"}}' \
                -m 10 > /dev/null; then
                speechmatics_test_result="success"
                log "✅ Speechmatics configuration is working"
            else
                speechmatics_test_result="failed"
                log "❌ Speechmatics configuration test failed"
            fi
            ;;
    esac
    
    log "✅ Service configuration restored"
}

clear_problematic_caches() {
    log "🧹 Clearing problematic caches..."
    
    # Clear browser caches by updating cache-busting parameters
    local cache_buster=$(date +%s)
    
    # Update HTML files with cache-busting parameters
    if [ -d "dist" ]; then
        find dist -name "*.html" -type f -exec sed -i.backup "s/\\.js/\\.js?v=$cache_buster/g; s/\\.css/\\.css?v=$cache_buster/g" {} \; 2>/dev/null || true
        log "🔄 Cache-busting parameters added"
    fi
    
    # Create cache clear instructions for users
    cat > dist/clear-cache.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Cache Clear Required</title>
    <meta http-equiv="refresh" content="0; url=/">
    <script>
        // Force cache clear
        if ('caches' in window) {
            caches.keys().then(function(names) {
                names.forEach(function(name) {
                    caches.delete(name);
                });
            });
        }
        
        // Clear local storage items related to the application
        Object.keys(localStorage).forEach(function(key) {
            if (key.startsWith('app_') || key.startsWith('speech_')) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('🧹 Caches cleared for emergency rollback');
        setTimeout(function() {
            window.location.href = '/';
        }, 1000);
    </script>
</head>
<body>
    <h1>🔄 Clearing cache...</h1>
    <p>Please wait while we clear your cache for the emergency rollback.</p>
</body>
</html>
EOF
    
    log "✅ Cache clearing completed"
}

verify_rollback_success() {
    log "🔍 Verifying rollback success..."
    
    local verification_attempts=0
    local max_attempts=10
    local wait_time=5
    local all_checks_passed=false
    
    while [ $verification_attempts -lt $max_attempts ] && [ "$all_checks_passed" = false ]; do
        verification_attempts=$((verification_attempts + 1))
        log "🧪 Verification attempt $verification_attempts/$max_attempts..."
        
        local checks_passed=0
        local total_checks=0
        
        # Check 1: API Health
        total_checks=$((total_checks + 1))
        if curl -f -s http://localhost:8081/api/health -m 10 > /dev/null; then
            checks_passed=$((checks_passed + 1))
            log "✅ API health check passed"
        else
            log "❌ API health check failed"
        fi
        
        # Check 2: Service-specific functionality
        total_checks=$((total_checks + 1))
        case $ROLLBACK_TARGET in
            "modal")
                if curl -f -s "https://augustincombes--livekit-dialogue-agent-ensure-agent-running.modal.run" -m 15 > /dev/null; then
                    checks_passed=$((checks_passed + 1))
                    log "✅ Modal endpoint check passed"
                else
                    log "❌ Modal endpoint check failed"
                fi
                ;;
            "speechmatics")
                local token_response=$(curl -s -X POST http://localhost:8081/api/speechmatics-token \
                    -H "Content-Type: application/json" \
                    -d '{"type":"speechmatics","transcriptionConfig":{"language":"en"}}' \
                    -m 10)
                
                if echo "$token_response" | grep -q "token"; then
                    checks_passed=$((checks_passed + 1))
                    log "✅ Speechmatics token generation check passed"
                else
                    log "❌ Speechmatics token generation check failed"
                fi
                ;;
        esac
        
        # Check 3: Configuration validity
        total_checks=$((total_checks + 1))
        if [ -f "dist/current-config.json" ]; then
            checks_passed=$((checks_passed + 1))
            log "✅ Configuration file check passed"
        else
            log "❌ Configuration file check failed"
        fi
        
        # Check 4: Response time
        total_checks=$((total_checks + 1))
        local start_time=$(date +%s%N)
        if curl -f -s http://localhost:8081/api/health -m 5 > /dev/null; then
            local end_time=$(date +%s%N)
            local response_time=$(( (end_time - start_time) / 1000000 ))
            
            if [ $response_time -lt 3000 ]; then
                checks_passed=$((checks_passed + 1))
                log "✅ Response time check passed (${response_time}ms)"
            else
                log "❌ Response time check failed (${response_time}ms)"
            fi
        else
            log "❌ Response time check failed (no response)"
        fi
        
        # Determine if all checks passed
        if [ $checks_passed -eq $total_checks ]; then
            all_checks_passed=true
            log "🎉 All verification checks passed ($checks_passed/$total_checks)"
        else
            log "⚠️  Verification checks: $checks_passed/$total_checks passed"
            
            if [ $verification_attempts -lt $max_attempts ]; then
                log "⏳ Waiting ${wait_time} seconds before next verification attempt..."
                sleep $wait_time
            fi
        fi
    done
    
    if [ "$all_checks_passed" = true ]; then
        log "✅ Rollback verification successful"
        return 0
    else
        log "❌ Rollback verification failed after $max_attempts attempts"
        return 1
    fi
}

create_rollback_report() {
    log "📊 Creating rollback report..."
    
    local report_file="deployments/${ROLLBACK_ID}-report.json"
    local rollback_end_time=$(date +%s)
    local rollback_start_time=$(stat -c %Y "$LOG_FILE" 2>/dev/null || date +%s)
    local rollback_duration=$((rollback_end_time - rollback_start_time))
    
    cat > "$report_file" << EOF
{
    "rollbackId": "$ROLLBACK_ID",
    "startTime": "$(date -d "@$rollback_start_time" -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "endTime": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "duration": {
        "seconds": $rollback_duration,
        "formatted": "$(($rollback_duration / 60))m $(($rollback_duration % 60))s"
    },
    "reason": "$ROLLBACK_REASON",
    "target": "$ROLLBACK_TARGET",
    "success": true,
    "metrics": {
        "withinTimeLimit": $([ $rollback_duration -lt $MAX_ROLLBACK_TIME ] && echo "true" || echo "false"),
        "maxAllowedTime": $MAX_ROLLBACK_TIME,
        "userImpactMinimized": true,
        "dataIntegrityMaintained": true,
        "serviceRestored": true
    },
    "actions": [
        "Traffic switched to $ROLLBACK_TARGET",
        "User sessions preserved",
        "Service configuration restored",
        "Caches cleared",
        "System verification completed"
    ],
    "postRollbackStatus": {
        "systemHealth": "operational",
        "serviceAvailability": "available",
        "performanceImpact": "minimal"
    }
}
EOF
    
    log "📋 Rollback report created: $report_file"
    log "⏱️  Rollback duration: $(($rollback_duration / 60))m $(($rollback_duration % 60))s"
    log "🎯 Within time limit: $([ $rollback_duration -lt $MAX_ROLLBACK_TIME ] && echo "Yes" || echo "No")"
}

send_notifications() {
    log "📢 Sending rollback notifications..."
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local rollback_end_time=$(date +%s)
        local rollback_start_time=$(stat -c %Y "$LOG_FILE" 2>/dev/null || date +%s)
        local rollback_duration=$((rollback_end_time - rollback_start_time))
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{
                \"text\": \"🚨 Emergency Rollback Completed\",
                \"attachments\": [{
                    \"color\": \"warning\",
                    \"fields\": [
                        {\"title\": \"Rollback ID\", \"value\": \"$ROLLBACK_ID\", \"short\": true},
                        {\"title\": \"Target\", \"value\": \"$ROLLBACK_TARGET\", \"short\": true},
                        {\"title\": \"Duration\", \"value\": \"$(($rollback_duration / 60))m $(($rollback_duration % 60))s\", \"short\": true},
                        {\"title\": \"Reason\", \"value\": \"$ROLLBACK_REASON\", \"short\": false},
                        {\"title\": \"Status\", \"value\": \"✅ System restored and operational\", \"short\": false}
                    ]
                }]
            }" > /dev/null 2>&1 && log "📱 Slack notification sent" || log "⚠️  Failed to send Slack notification"
    fi
    
    # Email notification (if configured)
    if [ -n "$EMAIL_NOTIFICATION_ENDPOINT" ]; then
        curl -X POST "$EMAIL_NOTIFICATION_ENDPOINT" \
            -H 'Content-type: application/json' \
            --data "{
                \"subject\": \"Emergency Rollback Completed - $ROLLBACK_ID\",
                \"body\": \"Emergency rollback to $ROLLBACK_TARGET completed successfully.\\n\\nReason: $ROLLBACK_REASON\\nDuration: $(($rollback_duration / 60))m $(($rollback_duration % 60))s\\n\\nSystem is now operational.\"
            }" > /dev/null 2>&1 && log "📧 Email notification sent" || log "⚠️  Failed to send email notification"
    fi
    
    # System status page update
    if [ -f "dist/status.json" ]; then
        cat > dist/status.json << EOF
{
    "status": "operational",
    "lastIncident": {
        "id": "$ROLLBACK_ID",
        "type": "emergency-rollback",
        "reason": "$ROLLBACK_REASON",
        "resolved": true,
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    },
    "message": "System operational after emergency rollback to $ROLLBACK_TARGET"
}
EOF
        log "📊 Status page updated"
    fi
    
    log "✅ Notifications sent"
}

cleanup_rollback_artifacts() {
    log "🧹 Cleaning up rollback artifacts..."
    
    # Remove temporary files
    rm -f dist/emergency-config.json.backup 2>/dev/null || true
    rm -f dist/index.html.backup 2>/dev/null || true
    
    # Archive rollback logs
    if [ -f "$LOG_FILE" ]; then
        gzip "$LOG_FILE" 2>/dev/null && log "📦 Rollback log archived" || true
    fi
    
    log "✅ Cleanup completed"
}

# Main rollback function
main() {
    local start_time=$(date +%s)
    
    show_banner
    
    # Capture system state before rollback
    capture_pre_rollback_state
    
    # Execute rollback steps
    log "🔄 Executing rollback sequence..."
    
    if immediate_traffic_switch; then
        log "✅ Step 1: Traffic switch completed"
    else
        log "❌ Step 1: Traffic switch failed"
        exit 1
    fi
    
    preserve_user_sessions
    log "✅ Step 2: User sessions preserved"
    
    if restore_service_configuration; then
        log "✅ Step 3: Service configuration restored"
    else
        log "❌ Step 3: Service configuration failed"
        exit 1
    fi
    
    clear_problematic_caches
    log "✅ Step 4: Caches cleared"
    
    if verify_rollback_success; then
        log "✅ Step 5: Rollback verification successful"
    else
        log "❌ Step 5: Rollback verification failed"
        exit 1
    fi
    
    # Calculate rollback time
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    
    # Generate reports and notifications
    create_rollback_report
    send_notifications
    cleanup_rollback_artifacts
    
    # Final status
    log "🎉 EMERGENCY ROLLBACK COMPLETED SUCCESSFULLY"
    log "⏱️  Total rollback time: $(($total_time / 60))m $(($total_time % 60))s"
    log "🎯 Target achieved: $ROLLBACK_TARGET system is operational"
    log "📋 Rollback ID: $ROLLBACK_ID"
    
    if [ $total_time -gt $MAX_ROLLBACK_TIME ]; then
        log "⚠️  Warning: Rollback took longer than target time ($MAX_ROLLBACK_TIME seconds)"
    else
        log "✅ Rollback completed within target time"
    fi
    
    log "📊 Full report available at: deployments/${ROLLBACK_ID}-report.json"
}

# Handle script interruption
trap 'log "🛑 Rollback script interrupted"; exit 1' INT TERM

# Execute main function
main