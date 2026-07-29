import { createContext } from 'react';
import type { ZendbxClient } from '@zendbx/sdk';
import type { CacheConfig } from '../types';

/**
 * ZendBX Context interface
 */
export interface ZendbxContextValue {
  client: ZendbxClient;
  config: CacheConfig;
}

/**
 * ZendBX React Context
 * Provides access to the SDK client and cache configuration
 */
export const ZendbxContext = createContext<ZendbxContextValue | null>(null);

ZendbxContext.displayName = 'ZendbxContext';
