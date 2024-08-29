// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../index')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

// TODO: this and many many more test cases