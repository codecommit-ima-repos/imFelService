const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const FormData = require('form-data');

module.exports.clientGetIdentificationDocumentInfile = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const body = event.body;
        const clientResponse = await getClient(body);
        return Promise.resolve(clientResponse);
    } catch (error) {
        return Promise.reject(error);
    }
};

async function getClient(body) {
    try {
        const bodyClientToken = await getBodyClientToken(body);
        const clientToken = await clientTokenInfileIdentificationDocument(bodyClientToken);
        console.log(JSON.stringify(clientToken));
        if (clientToken.resultado == 'false') {
            throw new Error(clientToken.descripcion);
        }
        const bodyClient = await getBodyClient(body);
        const clientInfile = await clientInfileIdentificationDocument(clientToken.token, bodyClient);
        console.log(JSON.stringify(clientInfile));
        if (clientInfile.resultado == 'false') {
            throw new Error(clientInfile.descripcion);
        }
        return Promise.resolve(clientInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyClient(body) {
    try {
        const data = new FormData();
        data.append('cui', body.client.clientIdentificationDocument);
        return Promise.resolve(data);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function clientInfileIdentificationDocument(token, body) {
    try {
        const res = await axios({
            method: 'post',
            url: config.clientDPIInfileUrl,
            headers: {
                ...body.getHeaders(),
                'Authorization': 'Bearer ' + token
            },
            data: body
        })
            .then(function (response) {
                return response;
            })
            .catch(function (error) {
                throw new Error('API ' + error);
            });
        return Promise.resolve(res.data);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyClientToken(body) {
    try {
        const data = new FormData();
        data.append('prefijo', 'FEL173TEMP');
        data.append('llave', 'EF01796B0F6B9EFDB743EE39BBBF9398');
        return Promise.resolve(data);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function clientTokenInfileIdentificationDocument(body) {
    try {
        const res = await axios({
            method: 'post',
            url: config.clientTokenInfileUrl,
            headers: {
                ...body.getHeaders()
            },
            data: body
        })
            .then(function (response) {
                return response;
            })
            .catch(function (error) {
                throw new Error(error);
            });
        return Promise.resolve(res.data);
    } catch (error) {
        return Promise.reject(error);
    }
}
