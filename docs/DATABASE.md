# Database Setup

This project uses Prisma ORM with MySQL for data persistence and NextAuth for authentication.

## Prerequisites

- MySQL server installed and running
- Node.js v20+ and npm v10+

## Setup Instructions

### 1. Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Database connection
DATABASE_URL="mysql://user:password@localhost:3306/acadlab"

# NextAuth configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

To generate a secure `NEXTAUTH_SECRET`, run:

```bash
openssl rand -base64 32
```

Replace:
- `user` with your MySQL username
- `password` with your MySQL password
- `localhost:3306` with your MySQL host and port if different
- `acadlab` with your desired database name
- `NEXTAUTH_SECRET` with your generated secret key

### 2. Create the Database

Connect to MySQL and create the database:

```sql
CREATE DATABASE acadlab;
```

Or use the MySQL command line:

```bash
mysql -u root -p -e "CREATE DATABASE acadlab;"
```

### 3. Push Schema to Database

Run Prisma migration to create the tables:

```bash
npm run db:push
```

This will create the necessary tables based on the Prisma schema.

### 4. Seed the Database (Optional)

To create test users for development:

```bash
npm run db:seed
```

This will create three test users:
- **Professor**: professor@acadlab.com / password123
- **Technician**: technician@acadlab.com / password123
- **Administrator**: admin@acadlab.com / password123

## Available Scripts

- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database
- `npm run db:seed` - Seed database with test data

## Database Schema

### Users Table

The `users` table stores authentication and user information:

| Field         | Type     | Description                                    |
|---------------|----------|------------------------------------------------|
| id            | String   | Unique identifier (CUID)                       |
| email         | String   | User email (unique)                            |
| name          | String   | User's full name                               |
| password      | String   | Hashed password (bcrypt)                       |
| role          | Enum     | PROFESSOR, TECHNICIAN, or ADMINISTRATOR        |
| emailVerified | DateTime | Email verification timestamp (NextAuth)        |
| image         | String   | User profile image URL (optional)              |
| createdAt     | DateTime | Account creation timestamp                     |
| updatedAt     | DateTime | Last update timestamp                          |

### Accounts Table

The `accounts` table stores OAuth provider information (NextAuth):

| Field             | Type     | Description                        |
|-------------------|----------|------------------------------------|
| userId            | String   | Reference to user                  |
| type              | String   | Account type (oauth, credentials)  |
| provider          | String   | Provider name                      |
| providerAccountId | String   | Provider account ID                |
| refresh_token     | Text     | OAuth refresh token (optional)     |
| access_token      | Text     | OAuth access token (optional)      |
| expires_at        | Int      | Token expiration timestamp         |
| token_type        | String   | Token type                         |
| scope             | String   | OAuth scope                        |
| id_token          | Text     | OAuth ID token (optional)          |
| session_state     | String   | Session state (optional)           |

### Sessions Table

The `sessions` table stores user sessions (NextAuth):

| Field        | Type     | Description                |
|--------------|----------|----------------------------|
| sessionToken | String   | Unique session token       |
| userId       | String   | Reference to user          |
| expires      | DateTime | Session expiration time    |
| createdAt    | DateTime | Session creation timestamp |
| updatedAt    | DateTime | Last update timestamp      |

### Verification Tokens Table

The `verification_tokens` table stores email verification tokens (NextAuth):

| Field      | Type     | Description                |
|------------|----------|----------------------------|
| identifier | String   | User identifier (email)    |
| token      | String   | Verification token         |
| expires    | DateTime | Token expiration time      |

## Troubleshooting

### Connection Issues

If you get a connection error:

1. Ensure MySQL is running
2. Verify credentials in `.env`
3. Check that the database exists
4. Ensure MySQL user has proper permissions

### Schema Changes

After modifying `prisma/schema.prisma`:

```bash
npm run db:push
npm run db:generate
```

## Production Notes

For production deployment:

1. Use a secure password for the database user
2. Never commit `.env` file to version control
3. Consider using connection pooling for better performance
4. Implement proper backup strategies
5. Use environment-specific database instances
