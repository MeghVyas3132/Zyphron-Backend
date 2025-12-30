// ===========================================
// KAFKA CLIENT
// ===========================================

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from '@/config/index.js';
import { createLogger } from '@/lib/logger.js';

const logger = createLogger('kafka');

// ===========================================
// KAFKA TOPICS
// ===========================================

export const TOPICS = {
  DEPLOYMENTS: 'zyphron.deployments',
  BUILD_LOGS: 'zyphron.build-logs',
  METRICS: 'zyphron.metrics',
  NOTIFICATIONS: 'zyphron.notifications',
  AUDIT: 'zyphron.audit',
} as const;

// ===========================================
// KAFKA CLIENT SINGLETON
// ===========================================

let kafka: Kafka | null = null;
let producerInstance: Producer | null = null;

function getKafkaClient(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: config.env === 'development' ? logLevel.DEBUG : logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }
  return kafka;
}

// ===========================================
// PRODUCER
// ===========================================

export async function getProducer(): Promise<Producer> {
  if (!producerInstance) {
    const client = getKafkaClient();
    producerInstance = client.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
    
    await producerInstance.connect();
    logger.info('Kafka producer connected');
  }
  return producerInstance;
}

// Export producer object for direct use in routes
export const producer = {
  async send(payload: { topic: string; messages: Array<{ key?: string; value: string }> }) {
    const prod = await getProducer();
    return prod.send(payload);
  },
};

export async function sendMessage(
  topic: string,
  messages: { key?: string; value: unknown; headers?: Record<string, string> }[]
): Promise<void> {
  const prod = await getProducer();
  
  await prod.send({
    topic,
    messages: messages.map((msg) => ({
      key: msg.key,
      value: JSON.stringify(msg.value),
      headers: msg.headers,
    })),
  });
}

export async function sendDeploymentEvent(
  deploymentId: string,
  eventType: string,
  data: unknown
): Promise<void> {
  await sendMessage(TOPICS.DEPLOYMENTS, [{
    key: deploymentId,
    value: {
      eventType,
      deploymentId,
      timestamp: new Date().toISOString(),
      data,
    },
  }]);
}

export async function sendBuildLog(
  deploymentId: string,
  line: string,
  stream: 'stdout' | 'stderr' = 'stdout'
): Promise<void> {
  await sendMessage(TOPICS.BUILD_LOGS, [{
    key: deploymentId,
    value: {
      deploymentId,
      line,
      stream,
      timestamp: new Date().toISOString(),
    },
  }]);
}

// ===========================================
// CONSUMER
// ===========================================

export async function createConsumer(
  groupId: string,
  topics: string[],
  handler: (topic: string, message: unknown) => Promise<void>
): Promise<Consumer> {
  const client = getKafkaClient();
  const consumer = client.consumer({ groupId });
  
  await consumer.connect();
  logger.info({ groupId }, 'Kafka consumer connected');
  
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = message.value ? JSON.parse(message.value.toString()) : null;
        await handler(topic, value);
      } catch (error) {
        logger.error({ error, topic, partition }, 'Error processing Kafka message');
      }
    },
  });
  
  return consumer;
}

// ===========================================
// CONNECTION HELPERS
// ===========================================

export async function disconnectKafka(): Promise<void> {
  if (producerInstance) {
    await producerInstance.disconnect();
    producerInstance = null;
    logger.info('Kafka producer disconnected');
  }
}

export async function checkKafkaHealth(): Promise<boolean> {
  try {
    const client = getKafkaClient();
    const admin = client.admin();
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();
    return true;
  } catch {
    return false;
  }
}
