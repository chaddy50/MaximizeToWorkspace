import {WindowStateTracker} from '../maximize-to-workspace@nchaddy.github.io/lib/windowStateTracker.js';

import {
    test, assertTrue, assertFalse, assertThrows, reportAndExit,
    fakeWindow, runMainLoopBriefly,
} from './harness.js';

test('markManaged and clearManaged round-trip through isManaged', () => {
    const tracker = new WindowStateTracker();
    const window = fakeWindow();

    tracker.markManaged(window);
    assertTrue(tracker.isManaged(window), 'managed after markManaged');

    tracker.clearManaged(window);
    assertFalse(tracker.isManaged(window), 'managed after clearManaged');

    tracker.destroy();
});

test('isManaged is false for an untracked window', () => {
    const tracker = new WindowStateTracker();

    assertFalse(tracker.isManaged(fakeWindow()), 'untracked window');

    tracker.destroy();
});

test('runGuarded runs the action and reports that it ran', () => {
    const tracker = new WindowStateTracker();
    let actionRunCount = 0;

    const didRun = tracker.runGuarded(fakeWindow(), () => {
        actionRunCount++;
    });

    assertTrue(didRun, 'runGuarded return value');
    assertTrue(actionRunCount === 1, 'action ran exactly once');

    tracker.destroy();
});

test('runGuarded refuses to re-enter for the same window', () => {
    const tracker = new WindowStateTracker();
    const window = fakeWindow();
    let innerRan = false;
    let innerResult = null;

    tracker.runGuarded(window, () => {
        innerResult = tracker.runGuarded(window, () => {
            innerRan = true;
        });
    });

    assertFalse(innerRan, 'inner action ran');
    assertFalse(innerResult, 'inner runGuarded return value');

    tracker.destroy();
});

test('runGuarded releases the guard on the next main-loop turn', () => {
    const tracker = new WindowStateTracker();
    const window = fakeWindow();

    tracker.runGuarded(window, () => {});
    runMainLoopBriefly();

    let secondRan = false;
    const didRun = tracker.runGuarded(window, () => {
        secondRan = true;
    });

    assertTrue(didRun, 'second runGuarded return value');
    assertTrue(secondRan, 'second action ran');

    tracker.destroy();
});

test('runGuarded does not block a different window', () => {
    const tracker = new WindowStateTracker();
    const firstWindow = fakeWindow();
    const secondWindow = fakeWindow();
    let secondRan = false;
    let secondResult = null;

    tracker.runGuarded(firstWindow, () => {
        secondResult = tracker.runGuarded(secondWindow, () => {
            secondRan = true;
        });
    });

    assertTrue(secondRan, 'other window action ran');
    assertTrue(secondResult, 'other window runGuarded return value');

    tracker.destroy();
});

test('runGuarded releases the guard even when the action throws', () => {
    const tracker = new WindowStateTracker();
    const window = fakeWindow();

    assertThrows(() => {
        tracker.runGuarded(window, () => {
            throw new Error('deliberate failure');
        });
    }, 'runGuarded propagates the action error');

    runMainLoopBriefly();

    assertTrue(tracker.runGuarded(window, () => {}), 'guardable again after a throw');

    tracker.destroy();
});

test('deferOnce fires its callback and deregisters the source', () => {
    const tracker = new WindowStateTracker();
    let fired = false;

    tracker.deferOnce(10, () => {
        fired = true;
    });
    runMainLoopBriefly(60);

    assertTrue(fired, 'callback fired');
    assertFalse(tracker.hasPendingTimeouts(), 'pending timeouts remain');

    tracker.destroy();
});

test('destroy cancels pending timeouts so they never fire', () => {
    const tracker = new WindowStateTracker();
    let fired = false;

    tracker.deferOnce(50, () => {
        fired = true;
    });
    tracker.destroy();
    runMainLoopBriefly(200);

    assertFalse(fired, 'callback fired after destroy');
});

test('destroy is safe to call twice', () => {
    const tracker = new WindowStateTracker();

    tracker.destroy();
    tracker.destroy();

    assertFalse(tracker.hasPendingTimeouts(), 'pending timeouts after double destroy');
});

test('windows with distinct ids are tracked independently', () => {
    const tracker = new WindowStateTracker();
    const firstWindow = fakeWindow();
    const secondWindow = fakeWindow();

    tracker.markManaged(firstWindow);

    assertTrue(tracker.isManaged(firstWindow), 'first window managed');
    assertFalse(tracker.isManaged(secondWindow), 'second window managed');

    tracker.destroy();
});

reportAndExit();
