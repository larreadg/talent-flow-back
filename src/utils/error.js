export class TalentFlowError extends Error {
    constructor(message, code = 500){
        super(message)
        this.code = code
    }
}