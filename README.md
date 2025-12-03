# C-Parker Backend

**Complete NestJS backend with integrated blockchain event listeners for the C-Parker Orbit Matrix Platform.**

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Features](#features)
- [Troubleshooting](#troubleshooting)

---

## Overview

This backend provides:
- **Real-time blockchain event listening** from OrbitA and OrbitB smart contracts
- **RESTful API** for user data, payments, statistics, and activity feeds
- **PostgreSQL database** with optimized schema (no redundant data)
- **In-memory caching** for performance
- **Swagger API documentation** at `/docs`
- **TypeScript** for type safety

**Tech Stack:**
- NestJS (Node.js framework)
- TypeScript
- PostgreSQL with TypeORM
- Ethers.js v6 (blockchain interaction)
- Winston (logging)
- Swagger (API docs)

---

## Prerequisites

Before you begin, ensure you have installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** (comes with Node.js)

**Optional:**
- **Git** - for cloning the repository

---

## Installation

### 1. Clone or Navigate to Project

```bash
cd c-parker/c-parker-backend
```

### 2. Install Dependencies

```bash
npm install
```

---

## Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp env.example .env
```

### 2. Configure `.env`

Open `.env` and fill in your values:

```env
# ============================================
# SERVER
# ============================================
PORT=4000
NODE_ENV=development

# ============================================
# DATABASE (PostgreSQL)
# ============================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_DATABASE=cparker

# ============================================
# BLOCKCHAIN RPC
# ============================================
# Choose ONE of these options:

# Option 1: Alchemy (Recommended)
RPC_PROVIDER=alchemy
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Option 2: Infura
# RPC_PROVIDER=infura
# INFURA_API_KEY=your_infura_key

# Network: sepolia, goerli, mainnet, polygon-amoy, etc.
NETWORK=polygon-amoy

# ============================================
# SMART CONTRACTS
# ============================================
ORBIT_A_ADDRESS=0xYourOrbitAContractAddress
ORBIT_B_ADDRESS=0xYourOrbitBContractAddress

# ============================================
# EVENT LISTENER
# ============================================
ENABLE_EVENT_LISTENER=true

# Start from specific block or 'latest' for current block
START_BLOCK=latest

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
```
---

## Database Setup

### 1. Create PostgreSQL Database

**Option A: Using `psql` command line:**

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE cparker;

# Exit
\q
```

### 2. Run Database Schema

The schema creates all tables, views, indexes, and functions:

```bash
# Make sure you're in the c-parker-backend directory
cd c-parker/c-parker-backend

# Run the schema
psql -U postgres -d cparker -f database-schema.sql
```

**Expected output:**
```
CREATE TYPE
CREATE TYPE
CREATE TABLE
CREATE INDEX
CREATE TABLE
...
✓ Database schema created successfully
```

### 3. Reset Database (Optional)

If you need to reset the database (CAUTION: deletes all data):

```bash
# Make script executable
chmod +x reset-database.sh

# Run reset script
./reset-database.sh
```

This script will:
- Drop and recreate the database
- Run the schema
- Prompt for confirmation

---

## Running the Application

### Development Mode (with auto-reload)

```bash
npm run start:dev
```

The server will start on `http://localhost:4000`

**You should see:**
```
[Nest] Application successfully started
[EventListenerService] Starting blockchain event listeners...
[BlockchainService] ✓ Connected to polygon-amoy (chainId: 80002)
[EventListenerService] ✓ OrbitA listeners configured
[EventListenerService] ✓ OrbitB listeners configured
[EventListenerService] ✓ Listening for events from block latest
```

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

## API Documentation

### Swagger Documentation

Once the server is running, access interactive API docs:

```
http://localhost:4000/docs
```

### API Base URL

```
http://localhost:4000/api/v1
```

### Key Endpoints

**All endpoints now use blockchain `userId` (not internal database ID):**

#### Users
- `GET /users/:userId` - Get user profile
- `GET /users/:userId/stats` - User statistics
- `GET /users/:userId/referrals` - Direct referrals
- `GET /users/:userId/team` - Full team (recursive)
- `GET /users/:userId/levels` - User levels
- `GET /users/:userId/matrix/:orbit/:level` - Matrix downlines
- `GET /users/wallet/:address` - Get user by wallet address

#### Payments
- `GET /payments/user/:userId` - All payments
- `GET /payments/user/:userId/earned` - Received payments
- `GET /payments/user/:userId/missed` - Missed payments
- `GET /payments/user/:userId/by-level` - Earnings by level
- `GET /payments/user/:userId/total-earned` - Total earned
- `GET /payments/user/:userId/total-missed` - Total missed

#### Statistics
- `GET /statistics/platform` - Platform-wide statistics
- `GET /statistics/leaderboard?limit=100` - Top earners
- `GET /statistics/recent?hours=24` - Recent users

#### Activity
- `GET /activity/feed?limit=50&offset=0` - Activity feed
- `GET /activity/feed?eventNames=PaymentSent,UserRegistered` - Filtered activity

### Example Requests

```bash
# Get user by blockchain ID
curl http://localhost:4000/api/v1/users/2

# Get user statistics
curl http://localhost:4000/api/v1/users/2/stats

# Get platform statistics
curl http://localhost:4000/api/v1/statistics/platform

# Get activity feed
curl http://localhost:4000/api/v1/activity/feed?limit=10
```




