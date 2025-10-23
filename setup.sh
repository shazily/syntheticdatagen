#!/bin/bash

# Synthetic Data Generator Setup Script
# This script sets up the complete environment for the Synthetic Data Generator

set -e

echo "🚀 Setting up Synthetic Data Generator..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        print_status "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        print_status "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if Ollama is installed
check_ollama() {
    print_status "Checking Ollama installation..."
    if ! command -v ollama &> /dev/null; then
        print_warning "Ollama is not installed. The application will work with fallback schema generation."
        print_status "To install Ollama:"
        print_status "  curl -fsSL https://ollama.ai/install.sh | sh"
        print_status "  ollama pull llama2"
        print_status "  ollama serve"
    else
        print_success "Ollama is installed"
        
        # Check if Ollama is running
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            print_success "Ollama service is running"
        else
            print_warning "Ollama is installed but not running. Start it with: ollama serve"
        fi
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    mkdir -p uploads
    mkdir -p generated_data
    mkdir -p logs
    mkdir -p ssl
    print_success "Directories created"
}

# Set up environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp env.example .env
        print_success "Environment file created from template"
        
        # Generate a random secret key
        SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
        sed -i.bak "s/your-secret-key-here/$SECRET_KEY/" .env
        rm .env.bak 2>/dev/null || true
        
        print_success "Secret key generated"
    else
        print_warning "Environment file already exists, skipping..."
    fi
}

# Pull Docker images
pull_images() {
    print_status "Pulling Docker images..."
    docker-compose pull
    print_success "Docker images pulled"
}

# Build application
build_application() {
    print_status "Building application..."
    docker-compose build
    print_success "Application built"
}

# Start services
start_services() {
    print_status "Starting services..."
    docker-compose up -d
    print_success "Services started"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for database
    print_status "Waiting for database..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Database failed to start within 60 seconds"
        exit 1
    fi
    
    print_success "Database is ready"
    
    # Wait for web application
    print_status "Waiting for web application..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_error "Web application failed to start within 60 seconds"
        exit 1
    fi
    
    print_success "Web application is ready"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    docker-compose exec web python -c "
from app import app, db
with app.app_context():
    db.create_all()
    print('Database tables created')
"
    print_success "Database migrations completed"
}

# Display final information
display_info() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📍 Access your application:"
    echo "   Local:  http://localhost:8080"
    echo "   Docker: http://localhost (with nginx)"
    echo ""
    echo "🔧 Useful commands:"
    echo "   View logs:      docker-compose logs -f"
    echo "   Stop services:  docker-compose down"
    echo "   Restart:        docker-compose restart"
    echo "   Update:         docker-compose pull && docker-compose up -d"
    echo ""
    echo "📚 Documentation:"
    echo "   README.md - Complete usage guide"
    echo "   API endpoints available at /api/"
    echo ""
    
    if ! command -v ollama &> /dev/null; then
        echo "⚠️  Ollama not installed - install for AI-powered features:"
        echo "   curl -fsSL https://ollama.ai/install.sh | sh"
        echo "   ollama pull llama2"
        echo "   ollama serve"
        echo ""
    fi
    
    echo "🚀 Happy data generating!"
}

# Main setup function
main() {
    echo "Synthetic Data Generator Setup"
    echo "=============================="
    echo ""
    
    check_docker
    check_ollama
    create_directories
    setup_environment
    pull_images
    build_application
    start_services
    wait_for_services
    run_migrations
    display_info
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Synthetic Data Generator Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --quick        Skip Ollama checks and setup"
        echo "  --no-build     Skip Docker build step"
        echo "  --stop         Stop all services"
        echo "  --clean        Stop services and remove volumes"
        echo ""
        exit 0
        ;;
    --quick)
        print_warning "Quick setup mode - skipping Ollama checks"
        check_docker
        create_directories
        setup_environment
        pull_images
        build_application
        start_services
        wait_for_services
        run_migrations
        display_info
        ;;
    --no-build)
        print_warning "Skipping Docker build step"
        check_docker
        check_ollama
        create_directories
        setup_environment
        pull_images
        start_services
        wait_for_services
        run_migrations
        display_info
        ;;
    --stop)
        print_status "Stopping services..."
        docker-compose down
        print_success "Services stopped"
        ;;
    --clean)
        print_status "Stopping services and removing volumes..."
        docker-compose down -v
        print_success "Services stopped and volumes removed"
        ;;
    *)
        main
        ;;
esac
