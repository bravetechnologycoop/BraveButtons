const SessionState = require('../SessionState.js')

function createTestSessionState() {
  return new SessionState(
    'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
    'fakeInstallationId',
    'fakeButtonId',
    'fakeUnit',
    'fakePhone',
    'fakeState',
    'fakeNumPresses',
    'fakeCreatedAt',
    'fakeUpdatedAt',
    '1',
    'fakeNotes',
    'fakeFallbackTwilioState',
    null,
    new Date('2000-06-06T00:53:53.000Z'),
  )
}

module.exports = {
  createTestSessionState,
}
