# CCXT OHLCV Loader

A multi-exchange cryptocurrency OHLCV data loader using CCXT for real-time price data collection. This service collects 1-minute candle data from multiple cryptocurrency exchanges and stores it in PostgreSQL for analysis and trading applications.

## Features

- **Multi-Exchange Support**: Supports Binance, OKX, Bybit, Gate.io via CCXT
- **Real-time Data Collection**: Continuous 1-minute OHLCV data collection
- **PostgreSQL Storage**: Efficient batch storage with conflict resolution
- **Market Type Support**: Both spot and perpetual futures markets
- **Gap-Free Collection**: Automatic backfilling and continuous data collection
- **Health Monitoring**: Built-in health checks and monitoring endpoints
- **Configurable Symbols**: Customizable symbol lists and blacklists

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- PostgreSQL database
- Exchange API keys (optional for public data)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ccxt-ohlcv-loader.git
cd ccxt-ohlcv-loader

# Install dependencies
bun install
# or
pnpm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` file with your settings:

```bash
# Database Configuration
DATABASE_URL=postgres://user:password@localhost:5432/database

# Application Settings
NODE_ENV=production
HISTORICAL_LOOKBACK_DAYS=7

# Optional: Symbol blacklist (comma-separated)
SYMBOL_BLACKLIST=SHIB/USDT,PEPE/USDT
```

### Running

```bash
# Development mode
bun run dev

# Production mode
bun run start

# Type checking
bun run tsc
```

## Architecture

### Data Flow

1. **Initialization**: Service starts and connects to PostgreSQL
2. **Symbol Discovery**: Fetches available trading pairs from each exchange
3. **Historical Backfill**: Loads historical data based on `HISTORICAL_LOOKBACK_DAYS`
4. **Real-time Collection**: Continuously collects new 1-minute candles
5. **Storage**: Batches and stores data in PostgreSQL with conflict resolution

### Database Schema

The service creates separate tables for each exchange and market type:

```sql
CREATE TABLE binance_spot_ohlcv (
  symbol VARCHAR(50) NOT NULL,
  open_time TIMESTAMP NOT NULL,
  open DECIMAL(20,8) NOT NULL,
  high DECIMAL(20,8) NOT NULL,
  low DECIMAL(20,8) NOT NULL,
  close DECIMAL(20,8) NOT NULL,
  volume DECIMAL(20,8) NOT NULL,
  close_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (symbol, open_time)
);
```

### Supported Exchanges

All ccxt supported exchanges

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `NODE_ENV` | Environment (development/production) | development | ❌ |
| `HISTORICAL_LOOKBACK_DAYS` | Days to backfill on first run | 7 | ❌ |
| `SYMBOL_BLACKLIST` | Comma-separated symbol blacklist | - | ❌ |
| `PERSISTENCE_BATCH_SIZE` | Batch size for database inserts | 1000 | ❌ |

## API Endpoints

The service exposes these endpoints:

- `GET /health` - Health check endpoint
- `GET /` - Service info endpoint

## Deployment

### Docker

```bash
# Build image
docker build -t ccxt-ohlcv-loader .

# Run container
docker run -d \
  --name ccxt-loader \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -p 8080:8080 \
  ccxt-ohlcv-loader
```

### Production Deployment

1. **Environment Setup**: Configure production database and environment variables
2. **Database Migration**: Ensure PostgreSQL is accessible and configured
3. **Service Start**: Deploy using your preferred container orchestration platform
4. **Monitoring**: Monitor health endpoint and application logs

## Development

### Project Structure

```
ccxt-ohlcv-loader/
├── src/
│   ├── exchanges/         # Exchange clients and configuration
│   ├── loading/          # Data loading logic
│   ├── parsing/          # Data parsing and validation
│   ├── persistence/      # Database operations
│   ├── server/           # Web server and cron jobs
│   ├── utils/            # Utility functions
│   └── env.ts            # Environment configuration
├── index.ts              # Application entry point
└── tsconfig.json         # TypeScript configuration
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run type checking: `bun run tsc`
5. Submit a pull request

## Monitoring and Troubleshooting

### Logs

The service provides detailed logging for:
- Exchange connection status
- Data collection progress
- Database operations
- Error handling and retries

