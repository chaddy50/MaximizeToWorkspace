import GLib from 'gi://GLib';

import {
    test, assertTrue, assertEqual, reportAndExit,
    readTextFile, EXTENSION_DIR, EXTENSION_UUID,
} from './harness.js';

const metadataPath = GLib.build_filenamev([EXTENSION_DIR, 'metadata.json']);
const metadataText = readTextFile(metadataPath);

const schemaPath = GLib.build_filenamev([
    EXTENSION_DIR, 'schemas', 'org.gnome.shell.extensions.maximize-to-workspace.gschema.xml',
]);

test('metadata.json is valid JSON', () => {
    JSON.parse(metadataText);
});

test('uuid matches the extension directory name', () => {
    const metadata = JSON.parse(metadataText);

    // A mismatch makes the shell silently refuse to load the extension.
    assertEqual(metadata.uuid, GLib.path_get_basename(EXTENSION_DIR), 'uuid vs directory name');
    assertEqual(metadata.uuid, EXTENSION_UUID, 'uuid vs expected uuid');
});

test('shell-version covers GNOME 50', () => {
    const metadata = JSON.parse(metadataText);

    assertTrue(metadata['shell-version'].includes('50'), 'shell-version includes "50"');
});

test('settings-schema matches the id declared in the gschema XML', () => {
    const metadata = JSON.parse(metadataText);
    const schemaText = readTextFile(schemaPath);
    const declaredId = schemaText.match(/<schema\s+id="([^"]+)"/)?.[1];

    // A mismatch throws at getSettings() the moment the extension is enabled.
    assertEqual(metadata['settings-schema'], declaredId, 'settings-schema vs schema id');
});

test('every required manifest key is present and non-empty', () => {
    const metadata = JSON.parse(metadataText);

    for (const key of ['uuid', 'name', 'description', 'shell-version']) {
        assertTrue(metadata[key] !== undefined, `${key} is present`);
        assertTrue(metadata[key].length > 0, `${key} is non-empty`);
    }
});

test('no session-modes key, so the extension never runs on the lock screen', () => {
    const metadata = JSON.parse(metadataText);

    assertEqual(metadata['session-modes'], undefined, 'session-modes');
});

reportAndExit();
