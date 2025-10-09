# Database Setup

This project uses Prisma ORM with MySQL for data persistence.

## Prerequisites

- MySQL server installed and running
- Node.js v20+ and npm v10+

## Setup Instructions

### 1. Configure Database Connection

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Update the `DATABASE_URL` in your `.env` file with your MySQL credentials:

```
DATABASE_URL="mysql://user:password@localhost:3306/acadlab"
```

Replace:
- `user` with your MySQL username
- `password` with your MySQL password
- `localhost:3306` with your MySQL host and port if different
- `acadlab` with your desired database name

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

### User Table

The `users` table stores authentication and user information:

| Field     | Type     | Description                    |
|-----------|----------|--------------------------------|
| id        | String   | Unique identifier (CUID)       |
| email     | String   | User email (unique)            |
| name      | String   | User's full name               |
| password  | String   | Hashed password (bcrypt)       |
| role      | Enum     | PROFESSOR, TECHNICIAN, or ADMINISTRATOR |
| createdAt | DateTime | Account creation timestamp     |
| updatedAt | DateTime | Last update timestamp          |

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
