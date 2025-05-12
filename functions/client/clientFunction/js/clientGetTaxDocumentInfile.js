const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');

module.exports.clientGetTaxDocumentInfile = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const clientResponse = await getClient(params);
        return Promise.resolve(clientResponse);
    } catch (error) {
        return Promise.reject(error);
    }
};

async function getClient(params) {
    try {
        const headersClient = await getHeadersClient();
        const bodyClient = await getBodyClient(params);
        const clientInfile = await clientInfileTaxDocument(headersClient, bodyClient);
        return Promise.resolve(clientInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersClient() {
    try {
        let headers = {
            headers: {
                'Content-Type': 'application/json'
            }
        };
        return Promise.resolve(headers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyClient(params) {
    try {
        const jsonInfile = {
            "emisor_clave": params.transmitter.transmitterKey,
            "emisor_codigo": params.transmitter.transmitterPrefix,
            "nit_consulta": params.client.clientTaxDocument
        };
        return Promise.resolve(jsonInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function clientInfileTaxDocument(headers, body) {
    try {
        const res = await axios.post(
            config.clientInfileUrl,
            body,
            headers
        );
        return Promise.resolve(res.data);
    } catch (error) {
        return Promise.reject(error);
    }
}
