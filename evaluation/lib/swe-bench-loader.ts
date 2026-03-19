import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractOracleFiles } from './metrics.js'

export interface SWEBenchInstance {
  repo: string
  instance_id: string
  base_commit: string
  patch: string
  test_patch: string
  problem_statement: string
  hints_text: string
  created_at: string
  version: string
  FAIL_TO_PASS: string
  PASS_TO_PASS: string
  environment_setup_commit: string
  difficulty: string
}

export interface SWEBenchDataset {
  metadata: {
    description: string
    source_dataset: string
    total_instances: number
    statistics: {
      total_instances_in_original: number
      subset_count: number
      percentage_of_original: number
    }
  }
  instances: SWEBenchInstance[]
}

const DEFAULT_DATASET_PATH = resolve(
  import.meta.dirname ?? '.',
  '../../vendor/context-please/evaluation/swe_verified_15min1h_2files_instances.json',
)

/**
 * Load the SWE-bench Verified dataset (30-instance subset).
 */
export function loadDataset(path = DEFAULT_DATASET_PATH): SWEBenchDataset {
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Get a specific instance by ID.
 */
export function getInstance(
  instanceId: string,
  path = DEFAULT_DATASET_PATH,
): SWEBenchInstance | undefined {
  const dataset = loadDataset(path)
  return dataset.instances.find(i => i.instance_id === instanceId)
}

/**
 * Get the oracle (ground truth) files for an instance.
 */
export function getOracleFiles(instance: SWEBenchInstance): string[] {
  return extractOracleFiles(instance.patch)
}

/**
 * Convert an instance ID to a valid directory name for eval fixtures.
 * e.g. "django__django-14170" -> "django-14170"
 */
export function instanceIdToEvalName(instanceId: string): string {
  // Remove the repo prefix duplication: "django__django-14170" -> "django-14170"
  const parts = instanceId.split('__')
  return parts.length > 1 ? parts[1] : instanceId
}
