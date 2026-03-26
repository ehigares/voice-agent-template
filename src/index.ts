import { initMemoryClient } from './layers/memory/memory-client.js';
import { startServer } from './layers/orchestration/webhook-handler.js';

await initMemoryClient();
startServer();
