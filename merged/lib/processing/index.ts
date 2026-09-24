import rawDb from '@/data/db.json';
import processingJson from '@/data/processing.json';
import type { Db } from '../types';
import { applyProcessing } from './overlay';
import type { ProcessingData } from './types';

export const processingData = processingJson as unknown as ProcessingData;

/** The database as the game plays it: authored data plus the processing layer. Built once. */
export const playDb: Db = applyProcessing(rawDb as unknown as Db, processingData);
