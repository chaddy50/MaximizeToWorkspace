import GLib from 'gi://GLib';

import {
    test, assertTrue, assertEqual, reportAndExit,
    readTextFile, runCommand, EXTENSION_DIR,
} from './harness.js';

const schemasDir = GLib.build_filenamev([EXTENSION_DIR, 'schemas']);
const schemaPath = GLib.build_filenamev([
    schemasDir, 'org.gnome.shell.extensions.maximize-to-workspace.gschema.xml',
]);
const schemaText = readTextFile(schemaPath);

const EXPECTED_KEYS = [
    {name: 'home-workspace-index', type: 'i', defaultValue: '0'},
    {name: 'force-fullscreen', type: 'b', defaultValue: 'true'},
    {name: 'return-on-minimize', type: 'b', defaultValue: 'true'},
    {name: 'return-on-unmaximize', type: 'b', defaultValue: 'true'},
    {name: 'startup-delay-ms', type: 'i', defaultValue: '3000'},
    {name: 'move-new-windows-home', type: 'b', defaultValue: 'true'},
];

function findKeyBlock(name) {
    const block = schemaText.match(
        new RegExp(`<key\\s+name="${name}"\\s+type="(\\w)">([\\s\\S]*?)</key>`));

    if (!block)
        throw new Error(`key "${name}" not found in the schema`);

    return {type: block[1], body: block[2]};
}

test('schema compiles cleanly under --strict', () => {
    const result = runCommand(['glib-compile-schemas', '--strict', '--dry-run', schemasDir]);

    assertEqual(result.exitStatus, 0, `glib-compile-schemas exit status (${result.stderr.trim()})`);
});

test('every planned key is present with the right type and default', () => {
    for (const expected of EXPECTED_KEYS) {
        const {type, body} = findKeyBlock(expected.name);
        const defaultValue = body.match(/<default>([\s\S]*?)<\/default>/)?.[1].trim();

        assertEqual(type, expected.type, `${expected.name} type`);
        assertEqual(defaultValue, expected.defaultValue, `${expected.name} default`);
    }
});

test('bounded keys declare a range', () => {
    const homeRange = findKeyBlock('home-workspace-index').body
        .match(/<range\s+min="(\d+)"\s+max="(\d+)"\s*\/>/);
    const delayRange = findKeyBlock('startup-delay-ms').body
        .match(/<range\s+min="(\d+)"\s+max="(\d+)"\s*\/>/);

    assertTrue(homeRange !== null, 'home-workspace-index declares a range');
    assertEqual(homeRange[1], '0', 'home-workspace-index range min');
    assertEqual(homeRange[2], '31', 'home-workspace-index range max');

    assertTrue(delayRange !== null, 'startup-delay-ms declares a range');
    assertEqual(delayRange[1], '0', 'startup-delay-ms range min');
    assertEqual(delayRange[2], '30000', 'startup-delay-ms range max');
});

test('every key carries a summary and a description', () => {
    for (const expected of EXPECTED_KEYS) {
        const {body} = findKeyBlock(expected.name);

        assertTrue(/<summary>[\s\S]*?<\/summary>/.test(body), `${expected.name} has a summary`);
        assertTrue(
            /<description>[\s\S]*?<\/description>/.test(body),
            `${expected.name} has a description`);
    }
});

reportAndExit();
