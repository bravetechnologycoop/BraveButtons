class Installation {
    constructor(id, name, responderPhoneNumber, fallbackPhoneNumber, incidentCategories, createdAt) {
        this.id = id
        this.name = name
        this.responderPhoneNumber = responderPhoneNumber
        this.fallbackPhoneNumber = fallbackPhoneNumber
        this.incidentCategories = incidentCategories
        this.createdAt = createdAt
    }
}

module.exports = Installation
