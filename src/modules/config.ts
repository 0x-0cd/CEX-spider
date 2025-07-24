import 'dotenv/config';
import { logger } from './logger';
import { z } from 'zod';

// 定义配置数据的Zod模式
const ConfigSchema = z.object({
  proxyUrl: z.string().url().optional(),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  exchanges: z.array(z.string()).default(['okx']),
  symbols: z.array(z.string()).default(['ETH/USDT'])
});

type Config = z.infer<typeof ConfigSchema>;

// 解析列表的辅助函数
const parseList = (value: string | undefined, defaultValue: string[]): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
};

// 从环境变量创建原始配置对象
const rawConfig = {
  proxyUrl: process.env.PROXY_URL || undefined,
  logLevel: process.env.LOG_LEVEL || undefined,
  nodeEnv: process.env.NODE_ENV || undefined,
  exchanges: parseList(process.env.EXCHANGES, ['okx']),
  symbols: parseList(process.env.SYMBOLS, ['ETH/USDT'])
};

// 使用Zod验证并解析配置
const config = ConfigSchema.parse(rawConfig);

logger.debug('Loaded configuration', config);

export default config;
export type { Config };