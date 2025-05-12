const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const xml2js = require('xml2js');

module.exports.clientGetTaxDocumentMegaprint = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const tokenResponse = await token(params);
        if (tokenResponse.SolicitaTokenResponse.tipo_respuesta[0] == 0) {
            const token = tokenResponse.SolicitaTokenResponse.token[0];
            const clientResponse = await client(params, token);
            if (clientResponse.RetornaDatosClienteResponse.tipo_respuesta[0] == 0) {
                return Promise.resolve({
                    "nit": params.client.clientTaxDocument,
                    "nombre": clientResponse.RetornaDatosClienteResponse.nombre[0],
                });
            } else {
                return Promise.reject(clientResponse.RetornaDatosClienteResponse.listado_errores[0].error[0].desc_error[0]);
            }
        } else {
            return Promise.reject(tokenResponse.SolicitaTokenResponse.listado_errores[0].error[0].desc_error[0]);
        }
    } catch (error) {
        return Promise.reject(error);
    }
};

async function client(params, token) {
    try {
        const headersClient = await getHeadersClient(token);
        const bodyClient = await getBodyClient(params);
        const clientMegaprint = await clientMegaprintTaxDocument(headersClient, bodyClient);
        return Promise.resolve(clientMegaprint);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersClient(token) {
    try {
        let headers = {
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': 'Bearer ' + token
            }
        };
        return Promise.resolve(headers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyClient(params) {
    try {
        const xml = `<?xml version="1.0" encoding="UTF-8"?><RetornaDatosClienteRequest><nit>` + params.client.clientTaxDocument + `</nit></RetornaDatosClienteRequest>`;
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function clientMegaprintTaxDocument(headers, body) {
    try {
        const res = await axios.post(
            config.clientMegaprintUrl,
            body,
            headers
        );
        const response = await xml2js.parseStringPromise(res.data, { mergeAttrs: true });
        return Promise.resolve(response);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function token(params) {
    try {
        const headersToken = await getHeadersToken();
        const bodyToken = await getBodyToken(params);
        const tokenMegaprint = await tokenMegaprintInvoice(headersToken, bodyToken);
        return Promise.resolve(tokenMegaprint);

    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersToken() {
    try {
        let headers = {
            headers: {
                'Content-Type': 'application/xml'
            }
        };
        return Promise.resolve(headers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyToken(params) {
    try {
        let xml = `<?xml version='1.0' encoding='UTF-8'?>
<SolicitaTokenRequest>
<usuario>` + params.transmitter.transmitterUser + `</usuario>
<apikey>` + params.transmitter.transmitterKey + `</apikey>
</SolicitaTokenRequest>`;
        xml = replaceAll(xml, '\n', '');
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function tokenMegaprintInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.tokenMegaprintUrl,
            body,
            headers
        );
        const response = await xml2js.parseStringPromise(res.data, { mergeAttrs: true });
        return Promise.resolve(response);
    } catch (error) {
        return Promise.reject(error);
    }
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}