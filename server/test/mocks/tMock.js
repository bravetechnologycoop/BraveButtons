// Third-party dependencies
const { use } = require('chai')
const i18next = require('i18next')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

use(sinonChai)

before(() => {
  sinon.stub(i18next, 't').returnsArg(0)
})

after(() => {
  i18next.t.restore()
})
