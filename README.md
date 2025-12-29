# EcoMatin API

This is a [Next.js](https://nextjs.org/) project used for backend only purpose.

## Global requirements

### Environment file

In the root folder, there is a file called `.env.local.example`. Rename this file by removing the _.example_ at the end the file's name.

### Setup local database (optional)

This action is **mandatory** if you are planing to make some update on the database.

- Install Mysql Server or any DBMS of your choice. [MySQL Download](https://dev.mysql.com/downloads/mysql/)
- Export the database of the testing site: _the database url is available in the file `env/.env.testing` under the variable `DATABASE_URL`_
- Create the database locally and import the downloaded data.

After the previous steps, make sure to update accordingly the `DATABASE_URL` value in the `.env.local` environment file.

### Package install

Before running the project locally your have to make sure all packages are installed.

```bash
npm install
```

> You also have to run the same command after every `git pull` to make is case a new package has been added in the `package.json`.

### Prisma client generation

Before running the project locally, another action to perform is to run:

```bash
npm run prisma:migrate
```

> You also have to run the same command after every `git pull` in case the `prisma/schema.prisma` file has changed.

## Run the project locally

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3500](http://localhost:3500) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
