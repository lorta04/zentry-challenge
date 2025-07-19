import { CONFIG } from 'cmd/api/config';
import { Elysia } from 'elysia';
import { MongoClient } from 'mongodb';

const client = new MongoClient(CONFIG.MONGO_URI);
await client.connect();

const db = client.db(CONFIG.MONGO_DB);
const usersCol = db.collection('relationship_users');

export const mongoPlugin = new Elysia({ name: 'mongo' }).decorate('usersCol', usersCol);
