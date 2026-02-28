#!/usr/bin/env node
/**
 * Platform-detecting launcher for the `soop-mcp` MCP server binary.
 *
 * Detects the current platform/arch/libc, resolves the appropriate
 * @pleaseai/soop-<platform>-<arch>[-<libc>] optional package, and
 * executes its pre-compiled `soop-mcp` binary.
 *
 * This file is compiled to packages/soop/dist/launcher-mcp.mjs by tsdown and is the
 * target of the `bin/soop-mcp` Node.js shim.
 */

import { execFileSync } from 'node:child_process'
import { findBinary } from './util'

execFileSync(findBinary('soop-mcp', import.meta.url), process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
})
