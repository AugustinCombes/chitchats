#!/bin/bash

# Pre-Migration Backup Script
# Creates comprehensive backups before Modal to Speechmatics migration

set -e

# Configuration
BACKUP_ID="backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups/${BACKUP_ID}"
LOG_FILE="${BACKUP_DIR}/backup.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [BACKUP] $1" | tee -a "$LOG_FILE"
}

show_banner() {
    echo "💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾"
    echo "💾           PRE-MIGRATION BACKUP             💾"
    echo "💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾💾"
    echo "📋 Backup ID: $BACKUP_ID"
    echo "📁 Backup Dir: $BACKUP_DIR"
    echo "⏰ Started: $(date)"
}

create_backup_structure() {
    log "📁 Creating backup directory structure..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/source-code"
    mkdir -p "$BACKUP_DIR/configuration"
    mkdir -p "$BACKUP_DIR/dependencies"
    mkdir -p "$BACKUP_DIR/deployment"
    mkdir -p "$BACKUP_DIR/logs"
    mkdir -p "$BACKUP_DIR/git-info"
    
    log "✅ Backup structure created"
}

backup_source_code() {
    log "📝 Backing up source code..."
    
    # Backup critical source files
    local source_dirs=("app" "components" "api" "dialogue" "scripts" "constants" "hooks" "utils")
    
    for dir in "${source_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log "📂 Backing up $dir/..."
            cp -r "$dir" "$BACKUP_DIR/source-code/" 2>/dev/null || {
                log "⚠️  Warning: Could not backup $dir (permissions or missing)"
            }
        else
            log "ℹ️  Directory $dir not found (skipping)"
        fi
    done
    
    # Backup important files in root
    local root_files=("package.json" "package-lock.json" "pnpm-lock.yaml" "tsconfig.json" "app.json" "app.config.js" "metro.config.js" "eslint.config.js")
    
    for file in "${root_files[@]}"; do
        if [ -f "$file" ]; then
            log "📄 Backing up $file..."
            cp "$file" "$BACKUP_DIR/source-code/" 2>/dev/null || {
                log "⚠️  Warning: Could not backup $file"
            }
        fi
    done
    
    log "✅ Source code backup completed"
}

backup_configuration() {
    log "⚙️  Backing up configuration files..."
    
    # Environment files
    local env_files=(".env" ".env.local" ".env.production" ".env.staging")
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            log "🔐 Backing up $env_file..."
            cp "$env_file" "$BACKUP_DIR/configuration/" 2>/dev/null || {
                log "⚠️  Warning: Could not backup $env_file"
            }
        fi
    done
    
    # GitHub Actions workflows
    if [ -d ".github" ]; then
        log "🔄 Backing up GitHub workflows..."
        cp -r ".github" "$BACKUP_DIR/configuration/" 2>/dev/null || {
            log "⚠️  Warning: Could not backup .github directory"
        }
    fi
    
    # Vercel configuration
    if [ -f "vercel.json" ]; then
        log "▲ Backing up Vercel configuration..."
        cp "vercel.json" "$BACKUP_DIR/configuration/"
    fi
    
    # Docker configuration (if exists)
    local docker_files=("Dockerfile" "docker-compose.yml" ".dockerignore")
    for docker_file in "${docker_files[@]}"; do
        if [ -f "$docker_file" ]; then
            log "🐳 Backing up $docker_file..."
            cp "$docker_file" "$BACKUP_DIR/configuration/"
        fi
    done
    
    log "✅ Configuration backup completed"
}

backup_dependencies() {
    log "📦 Backing up dependency configurations..."
    
    # Node.js dependencies
    local node_files=("package.json" "package-lock.json" "pnpm-lock.yaml" "yarn.lock")
    for dep_file in "${node_files[@]}"; do
        if [ -f "$dep_file" ]; then
            log "📦 Backing up $dep_file..."
            cp "$dep_file" "$BACKUP_DIR/dependencies/"
        fi
    done
    
    # Python dependencies
    if [ -d "dialogue" ]; then
        local python_files=("pyproject.toml" "poetry.lock" "requirements.txt" "uv.lock")
        for py_file in "${python_files[@]}"; do
            if [ -f "dialogue/$py_file" ]; then
                log "🐍 Backing up dialogue/$py_file..."
                cp "dialogue/$py_file" "$BACKUP_DIR/dependencies/"
            fi
        done
    fi
    
    # Create dependency snapshot
    log "📸 Creating dependency snapshot..."
    
    cat > "$BACKUP_DIR/dependencies/dependency-snapshot.txt" << EOF
# Dependency Snapshot - $(date)
# Backup ID: $BACKUP_ID

## Node.js Dependencies
$(npm list --depth=0 2>/dev/null || echo "npm list failed or not available")

## Python Dependencies (if available)
$(cd dialogue && poetry show 2>/dev/null || echo "Poetry not available or failed")

## System Information
- Node.js: $(node --version 2>/dev/null || echo "Not available")
- npm: $(npm --version 2>/dev/null || echo "Not available")
- Python: $(python3 --version 2>/dev/null || python --version 2>/dev/null || echo "Not available")
- Poetry: $(poetry --version 2>/dev/null || echo "Not available")
- OS: $(uname -a 2>/dev/null || echo "Not available")

EOF
    
    log "✅ Dependencies backup completed"
}

backup_deployment_artifacts() {
    log "🚀 Backing up deployment artifacts..."
    
    # Built artifacts
    if [ -d "dist" ]; then
        log "📦 Backing up dist/ directory..."
        cp -r "dist" "$BACKUP_DIR/deployment/" 2>/dev/null || {
            log "⚠️  Warning: Could not backup dist directory"
        }
    fi
    
    # Deployment scripts
    if [ -d "scripts" ]; then
        log "📜 Backing up deployment scripts..."
        cp -r "scripts" "$BACKUP_DIR/deployment/" 2>/dev/null || {
            log "⚠️  Warning: Could not backup scripts directory"
        }
    fi
    
    # Create deployment state snapshot
    cat > "$BACKUP_DIR/deployment/deployment-state.json" << EOF
{
  "backupId": "$BACKUP_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "currentBranch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "currentCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "workingDirectory": "$(pwd)",
  "deploymentUrls": {
    "production": "$(cat dist/deployment-info.json 2>/dev/null | jq -r '.productionUrl // "unknown"' || echo 'unknown')",
    "staging": "$(cat dist/deployment-info.json 2>/dev/null | jq -r '.stagingUrl // "unknown"' || echo 'unknown')"
  },
  "environmentStatus": {
    "nodeEnv": "$(echo $NODE_ENV)",
    "expoEnv": "$(echo $EXPO_ENV)",
    "ci": "$(echo $CI)"
  }
}
EOF
    
    log "✅ Deployment artifacts backup completed"
}

backup_logs() {
    log "📋 Backing up logs and monitoring data..."
    
    # System logs (if accessible)
    if [ -d "/var/log" ] && [ -r "/var/log/app.log" ]; then
        log "📄 Backing up application logs..."
        tail -1000 "/var/log/app.log" > "$BACKUP_DIR/logs/app.log" 2>/dev/null || {
            log "⚠️  Could not access system logs"
        }
    fi
    
    # Node.js logs
    if [ -f "npm-debug.log" ]; then
        cp "npm-debug.log" "$BACKUP_DIR/logs/"
    fi
    
    # Create current system state
    cat > "$BACKUP_DIR/logs/system-state.txt" << EOF
# System State at Backup Time
# $(date)

## Process Information
$(ps aux | grep -E "(node|npm|expo)" | head -10 || echo "No relevant processes found")

## Network Information
$(netstat -an | grep LISTEN | head -10 || echo "Netstat not available")

## Disk Space
$(df -h || echo "df command not available")

## Memory Usage
$(free -m 2>/dev/null || echo "Memory info not available")

## Environment Variables (filtered)
$(env | grep -E "(NODE|NPM|EXPO)" | sort || echo "No relevant env vars")

EOF
    
    log "✅ Logs backup completed"
}

backup_git_information() {
    log "🔍 Backing up Git repository information..."
    
    if [ -d ".git" ]; then
        # Git status and branch info
        cat > "$BACKUP_DIR/git-info/git-state.txt" << EOF
# Git Repository State - $(date)

## Current Branch
$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "Not a git repository")

## Current Commit
$(git rev-parse HEAD 2>/dev/null || echo "No commits")

## Git Status
$(git status 2>/dev/null || echo "Git status not available")

## Recent Commits (last 10)
$(git log --oneline -10 2>/dev/null || echo "No commit history")

## Remote URLs
$(git remote -v 2>/dev/null || echo "No remotes configured")

## Staged Changes
$(git diff --staged 2>/dev/null || echo "No staged changes")

## Unstaged Changes (summary)
$(git diff --stat 2>/dev/null || echo "No unstaged changes")

EOF
        
        # Backup important git files
        if [ -f ".gitignore" ]; then
            cp ".gitignore" "$BACKUP_DIR/git-info/"
        fi
        
        if [ -f ".gitattributes" ]; then
            cp ".gitattributes" "$BACKUP_DIR/git-info/"
        fi
        
        # Create patch of current changes
        if git diff HEAD > "$BACKUP_DIR/git-info/current-changes.patch" 2>/dev/null; then
            log "📄 Current changes saved as patch"
        fi
        
        log "✅ Git information backup completed"
    else
        log "ℹ️  Not a Git repository - skipping Git backup"
    fi
}

create_restoration_script() {
    log "🔧 Creating restoration script..."
    
    cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

# Restoration Script
# Restores the system state from this backup

set -e

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
RESTORE_TARGET="${1:-../}"

echo "🔄 RESTORING FROM BACKUP"
echo "📁 Backup: $BACKUP_DIR"
echo "🎯 Target: $RESTORE_TARGET"
echo ""

read -p "⚠️  This will overwrite current files. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restoration cancelled"
    exit 1
fi

echo "📦 Restoring source code..."
if [ -d "source-code" ]; then
    cp -r source-code/* "$RESTORE_TARGET" 2>/dev/null || {
        echo "⚠️  Some source files could not be restored"
    }
    echo "✅ Source code restored"
fi

echo "⚙️  Restoring configuration..."
if [ -d "configuration" ]; then
    # Restore environment files
    for env_file in configuration/.env*; do
        if [ -f "$env_file" ]; then
            cp "$env_file" "$RESTORE_TARGET" 2>/dev/null || {
                echo "⚠️  Could not restore $(basename $env_file)"
            }
        fi
    done
    
    # Restore GitHub workflows
    if [ -d "configuration/.github" ]; then
        cp -r "configuration/.github" "$RESTORE_TARGET" 2>/dev/null || {
            echo "⚠️  Could not restore .github directory"
        }
    fi
    
    echo "✅ Configuration restored"
fi

echo "📦 Restoring dependencies..."
if [ -d "dependencies" ]; then
    cp dependencies/package*.json "$RESTORE_TARGET" 2>/dev/null || true
    cp dependencies/pnpm-lock.yaml "$RESTORE_TARGET" 2>/dev/null || true
    
    # Restore Python dependencies
    if [ -f "dependencies/pyproject.toml" ]; then
        mkdir -p "$RESTORE_TARGET/dialogue"
        cp dependencies/pyproject.toml "$RESTORE_TARGET/dialogue/" 2>/dev/null || true
        cp dependencies/poetry.lock "$RESTORE_TARGET/dialogue/" 2>/dev/null || true
    fi
    
    echo "✅ Dependencies restored"
fi

echo "🔄 Reinstalling dependencies..."
cd "$RESTORE_TARGET"

if [ -f "package.json" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install || echo "⚠️  npm install failed"
fi

if [ -f "dialogue/pyproject.toml" ]; then
    echo "🐍 Installing Python dependencies..."
    cd dialogue
    poetry install || echo "⚠️  Poetry install failed"
    cd ..
fi

echo ""
echo "✅ RESTORATION COMPLETED"
echo "📋 Backup ID: $(basename $BACKUP_DIR)"
echo "📄 See backup logs for more details"
echo ""
echo "🔄 Next steps:"
echo "  1. Verify restored files are correct"
echo "  2. Test application functionality"
echo "  3. Check environment variables"
echo "  4. Restart services if needed"

EOF
    
    chmod +x "$BACKUP_DIR/restore.sh"
    log "✅ Restoration script created: $BACKUP_DIR/restore.sh"
}

create_backup_manifest() {
    log "📋 Creating backup manifest..."
    
    cat > "$BACKUP_DIR/MANIFEST.md" << EOF
# Backup Manifest

**Backup ID**: $BACKUP_ID  
**Created**: $(date)  
**Purpose**: Pre-migration backup for Modal to Speechmatics migration  

## Contents

### Source Code (\`source-code/\`)
- Application source files
- Component libraries
- API implementations
- Utility functions
- Configuration files

### Configuration (\`configuration/\`)
- Environment files (.env, .env.local, etc.)
- GitHub Actions workflows
- Deployment configurations
- Docker files (if present)

### Dependencies (\`dependencies/\`)
- package.json and lock files
- Python dependency files
- Dependency snapshot with versions

### Deployment (\`deployment/\`)
- Built artifacts (dist/)
- Deployment scripts
- Current deployment state information

### Logs (\`logs/\`)
- System state at backup time
- Application logs (if accessible)
- Process and network information

### Git Information (\`git-info/\`)
- Current branch and commit information
- Git status and recent commits
- Patch of current changes
- Git configuration files

## Restoration

To restore from this backup:

\`\`\`bash
cd $BACKUP_DIR
./restore.sh [target-directory]
\`\`\`

Or manually copy files from the appropriate subdirectories.

## File Count
- Source files: $(find "$BACKUP_DIR/source-code" -type f 2>/dev/null | wc -l || echo "0")
- Configuration files: $(find "$BACKUP_DIR/configuration" -type f 2>/dev/null | wc -l || echo "0")
- Total files: $(find "$BACKUP_DIR" -type f 2>/dev/null | wc -l || echo "0")

## Backup Size
$(du -h "$BACKUP_DIR" 2>/dev/null | tail -1 || echo "Size calculation failed")

---
Generated by pre-migration backup script
EOF
    
    log "✅ Backup manifest created"
}

validate_backup() {
    log "🔍 Validating backup integrity..."
    
    local validation_passed=true
    
    # Check critical files are backed up
    local critical_files=("source-code/package.json" "source-code/app" "configuration")
    
    for critical_file in "${critical_files[@]}"; do
        if [ -e "$BACKUP_DIR/$critical_file" ]; then
            log "✅ Critical backup verified: $critical_file"
        else
            log "❌ Critical backup missing: $critical_file"
            validation_passed=false
        fi
    done
    
    # Check backup directory structure
    local required_dirs=("source-code" "configuration" "dependencies")
    
    for req_dir in "${required_dirs[@]}"; do
        if [ -d "$BACKUP_DIR/$req_dir" ]; then
            local file_count=$(find "$BACKUP_DIR/$req_dir" -type f 2>/dev/null | wc -l)
            log "✅ Directory $req_dir exists with $file_count files"
        else
            log "❌ Required directory missing: $req_dir"
            validation_passed=false
        fi
    done
    
    # Check restoration script
    if [ -x "$BACKUP_DIR/restore.sh" ]; then
        log "✅ Restoration script is executable"
    else
        log "❌ Restoration script missing or not executable"
        validation_passed=false
    fi
    
    if [ "$validation_passed" = true ]; then
        log "✅ Backup validation passed"
        return 0
    else
        log "❌ Backup validation failed"
        return 1
    fi
}

# Main backup function
main() {
    show_banner
    
    create_backup_structure
    backup_source_code
    backup_configuration
    backup_dependencies
    backup_deployment_artifacts
    backup_logs
    backup_git_information
    create_restoration_script
    create_backup_manifest
    
    if validate_backup; then
        log "✅ Backup validation successful"
    else
        log "⚠️  Backup validation had issues - manual review recommended"
    fi
    
    # Calculate backup size and file count
    local backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "unknown")
    local file_count=$(find "$BACKUP_DIR" -type f 2>/dev/null | wc -l || echo "unknown")
    
    log "🎉 BACKUP COMPLETED SUCCESSFULLY"
    log "📁 Backup Directory: $BACKUP_DIR"
    log "📊 Backup Size: $backup_size"
    log "📄 File Count: $file_count"
    log "🔧 Restoration: cd $BACKUP_DIR && ./restore.sh"
    log "📋 Manifest: $BACKUP_DIR/MANIFEST.md"
    
    # Print final summary to stdout for calling scripts
    echo "Backup created: $BACKUP_DIR"
}

# Handle script interruption
trap 'log "🛑 Backup interrupted"; exit 1' INT TERM

# Execute main function
main