# API Updates

## New 24-Hour Activity Endpoint

### `GET /api/v1/activity/recent/24h`

Returns all platform activity from the last 24 hours.

#### Query Parameters:
- `limit` (optional, default: 100) - Maximum number of events to return
- `eventNames` (optional) - Comma-separated list of event names to filter
  - Example: `PaymentSent,UserRegistered`

#### Response:
```json
[
  {
    "id": 123,
    "eventName": "PaymentSent",
    "contract": "OrbitA",
    "userId": 5,
    "walletAddress": "0x...",
    "levelNumber": 2,
    "amount": "50.0",
    "transactionHash": "0x...",
    "blockTimestamp": "2025-11-15T10:30:00.000Z",
    "secondsAgo": 3600
  }
]
```

#### Features:
- ✅ Filters to only last 24 hours of activity
- ✅ Includes proper amount formatting (no scientific notation)
- ✅ Optional event name filtering
- ✅ Cached for 60 seconds (no cache when using filters)
- ✅ Properly joins with payments table for accurate amounts

#### Example Usage:

```bash
# Get all activity from last 24 hours
curl http://localhost:3000/api/v1/activity/recent/24h

# Get only payments from last 24 hours
curl http://localhost:3000/api/v1/activity/recent/24h?eventNames=PaymentSent

# Get last 50 events only
curl http://localhost:3000/api/v1/activity/recent/24h?limit=50

# Get registrations and activations from last 24 hours
curl http://localhost:3000/api/v1/activity/recent/24h?eventNames=UserRegistered,OrbitBActivated
```

---

## All Activity Endpoints

| Endpoint | Description | Filters |
|----------|-------------|---------|
| `GET /activity` | All platform activity (paginated) | limit, offset, eventNames |
| **`GET /activity/recent/24h`** | **Activity from last 24 hours** | **limit, eventNames** |
| `GET /activity/user/:userId` | Activity for specific user | limit |

---

## Swagger Documentation

All endpoints are documented in Swagger at:
- **URL**: http://localhost:3000/api
- Navigate to the "activity" section to see all endpoints and try them out

---

## Implementation Notes

### SQL Query
The endpoint uses PostgreSQL's `INTERVAL` function:
```sql
WHERE e.block_timestamp >= NOW() - INTERVAL '24 hours'
```

This ensures accurate 24-hour rolling window based on server time.

### Caching
- Cached for 60 seconds when no filters are applied
- Cache key: `activity:24h:{limit}`
- No caching when `eventNames` filter is used

### Performance
- Indexed on `block_timestamp` for fast queries
- Uses LATERAL join for efficient payment amount retrieval
- Limits results to prevent large response sizes



