#!/usr/bin/env node
/**
 * Script to check for invalid JSX data-* attribute placement
 * 
 * Valid:   <div data-slot="my-id" className="..." />
 * Invalid: <div className="..." /data-slot="my-id">  ← This causes 500 errors!
 * 
 * The bug: data-* attributes placed AFTER the self-closing /> 
 * causes esbuild to fail with: "Expected '>' but found 'data-slot'"
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TSX_EXTENSIONS = ['.tsx', '.ts'];
const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', '.vite'];

// Pattern to detect: /> followed by data-*
// This regex finds lines like: />data-slot="..." or />data-testid="..."
const INVALID_PATTERN = /\/>\s*data-/g;

// Alternative invalid pattern: space before /> and data- after
const INVALID_PATTERN_2 = /\/\s+data-/g;

function findTSXFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      if (EXCLUDED_DIRS.includes(item)) continue;
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findTSXFiles(fullPath, files);
      } else if (TSX_EXTENSIONS.includes(extname(item))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];
  
  lines.forEach((line, index) => {
    // Check for />data- pattern
    if (INVALID_PATTERN.test(line) || INVALID_PATTERN_2.test(line)) {
      errors.push({
        line: index + 1,
        content: line.trim(),
        error: 'data-* attribute found AFTER self-closing tag />'
      });
    }
  });
  
  return errors;
}

function main() {
  const searchDir = process.argv[2] || 'pages';
  const baseDir = join(process.cwd(), searchDir);
  
  console.log(`\n🔍 Checking JSX data-* attribute placement in: ${searchDir}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const files = findTSXFiles(baseDir);
  
  if (files.length === 0) {
    console.log('✅ No .tsx/.ts files found');
    process.exit(0);
  }
  
  console.log(`Found ${files.length} files to check\n`);
  
  let totalErrors = 0;
  const failedFiles = [];
  
  for (const file of files) {
    const errors = checkFile(file);
    
    if (errors.length > 0) {
      totalErrors += errors.length;
      failedFiles.push({ file, errors });
      
      console.log(`❌ ${file.replace(process.cwd() + '/', '')}`);
      errors.forEach(err => {
        console.log(`   Line ${err.line}: ${err.error}`);
        console.log(`   ${err.content.substring(0, 100)}${err.content.length > 100 ? '...' : ''}`);
      });
      console.log('');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  
  if (totalErrors > 0) {
    console.log(`\n❌ FOUND ${totalErrors} JSX syntax errors in ${failedFiles.length} files`);
    console.log('\n⚠️  These errors will cause 500 Internal Server Error in production!');
    console.log('\n📝 Fix: Move data-* attributes BEFORE the closing />');
    console.log('   ❌ <div className="..." /data-slot="id">');
    console.log('   ✅ <div className="..." data-slot="id" />');
    process.exit(1);
  } else {
    console.log(`\n✅ All ${files.length} files passed JSX data-* validation`);
    process.exit(0);
  }
}

main();
