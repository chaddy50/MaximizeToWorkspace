import GLib from 'gi://GLib';
import System from 'system';

/**
 * Runs each suite in its own gjs process, so a suite that exits or crashes cannot take the
 * rest of the run with it. Each suite reports its own TAP output and exit status.
 */

const SUITES = [
    'windowFilter.test.js',
    'workspaceResolver.test.js',
    'windowStateTracker.test.js',
    'metadata.test.js',
    'schema.test.js',
];

const [runnerPath] = GLib.filename_from_uri(import.meta.url);
const testsDirectory = GLib.path_get_dirname(runnerPath);
const decoder = new TextDecoder();

let failedSuiteCount = 0;

for (const suite of SUITES) {
    print(`# ---- ${suite} ----`);

    const [, stdout, stderr, exitStatus] = GLib.spawn_sync(
        testsDirectory, ['gjs', '-m', suite], null, GLib.SpawnFlags.SEARCH_PATH, null);

    const output = decoder.decode(stdout ?? new Uint8Array()).trimEnd();
    if (output)
        print(output);

    const errorOutput = decoder.decode(stderr ?? new Uint8Array()).trim();
    if (errorOutput)
        print(errorOutput);

    if (exitStatus !== 0) {
        failedSuiteCount++;
        print(`# SUITE FAILED: ${suite}`);
    }
}

print('');
if (failedSuiteCount > 0) {
    print(`# ${failedSuiteCount} of ${SUITES.length} suites failed`);
    System.exit(1);
}

print(`# all ${SUITES.length} suites passed`);
