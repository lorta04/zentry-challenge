## Frontend

The frontend provides a user interface to visualize and explore the Bacefook relationship network and user-specific data.

Made with help from v0.dev.

### Pages

1.  **Analytics**

    - Visualizes the relationship network graph for a queried user, showing referrer and friend connections.
    - Displays static leaderboards for:

      - **Network Strength**: based on friend and referral metrics.
      - **Referral Points**: based on points accumulated through referrals.

    - Leaderboard data can be filtered by date range.
    - Total user count is shown in the header.

2.  **User Profile**

    - Allows querying a user by username to view their profile.
    - Displays the **Top 3 Influential Friends** with their usernames and **Network Strength** values.
    - Shows a paginated table of **All Friends** with:

      - Friends Count
      - Referrals Count
      - Referral Points

### How to Run

1.  **Install dependencies:**

```
 bun install
```

2.  **Start the frontend development server:**

```
bun run dev
```

The frontend runs at [http://localhost:3001](http://localhost:3001). Ensure the backend is running and accessible on port `3000`.
