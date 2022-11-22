// Third-party dependencies
const i18next = require('i18next')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const CommonEn = require('./resources/translations/common.en.json')
const CommonEnFrBilingual = require('./resources/translations/common.en_fr_bilingual.json')
const CommonEsUs = require('./resources/translations/common.es_us.json')

const namespaces = ['chatbot']
const resources = {
  en: {
    common: CommonEn,
  },
  en_fr_bilingual: {
    common: CommonEnFrBilingual,
  },
  es_us: {
    common: CommonEsUs,
  },
}

function setup() {
  i18next
    .init({
      resources,
      debug: false,
      fallbackLng: 'en',
      supportedLngs: ['en', 'en_fr_bilingual', 'es_us'],
      ns: namespaces,
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
    })
    .catch(error => helpers.log(error))
}

module.exports = {
  setup,
}
