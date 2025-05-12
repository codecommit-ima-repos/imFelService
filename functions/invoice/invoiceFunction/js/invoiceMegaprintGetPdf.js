const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const xml2js = require('xml2js');
const {
    v4: uuidv4
} = require('uuid');
const AxiosError = require('axios-error');

module.exports.invoiceMegaprintGetPdf = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const tokenResponse = await token(params);
        console.log(tokenResponse);
        if (tokenResponse.SolicitaTokenResponse.tipo_respuesta[0] == 0) {
            const token = tokenResponse.SolicitaTokenResponse.token[0];
            console.log(token);

            const pdfBase64 = await getPdfMegaprint(token, params, params.authUuid);
            console.log(pdfBase64);
            if (pdfBase64.RetornaPDFResponse.tipo_respuesta[0] == 0) {
                return Promise.resolve(pdfBase64);
            } else {
                // return Promise.reject('PDF ' + pdfBase64.RetornaPDFResponse.listado_errores[0].error[0].desc_error[0]);
                return Promise.resolve({
                    RetornaPDFResponse: {
                        pdf: [

                        ]
                    }
                });
            }
        } else {
            return Promise.reject('Token ' + tokenResponse.SolicitaTokenResponse.listado_errores[0].error[0].desc_error[0]);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const err = new AxiosError(error);
            if (err.response.status == 406) {
                const response = await xml2js.parseStringPromise(err.response.data, {
                    mergeAttrs: true
                });
                return Promise.reject(response.FirmaDocumentoResponse.listado_errores[0].error[0].desc_error[0]);
            }
            return Promise.reject(err);
        } else
            return Promise.reject(error);
    }
};

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
        const response = await xml2js.parseStringPromise(res.data, {
            mergeAttrs: true
        });
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

async function getPdfMegaprint(token, params, authUuid) {
    try {
        const header = await getHeadersPdf(token);
        const body = await getBodyPdf(params, authUuid);
        const pdfMegaprint = await pdfMegaprintInvoice(header, body);
        return Promise.resolve(pdfMegaprint);
    } catch (error) {
        return Promise.reject(error);
    }

}

async function getHeadersPdf(token) {
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

async function getBodyPdf(params, authUuid) {
    try {
        let body = `<?xml version="1.0" encoding="UTF-8"?>
<RetornaPDFRequest>
<uuid>` + authUuid + `</uuid>
</RetornaPDFRequest>
`;
        body = replaceAll(body, '\n', '');
        return Promise.resolve(body);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function pdfMegaprintInvoice(headers, body) {
    try {
        console.log(body)
        const res = await axios.post(
            config.fileMegaprintUrl,
            body,
            headers
        );
        console.log(res)
        const response = await xml2js.parseStringPromise(res.data, {
            mergeAttrs: true
        });
        return Promise.resolve(response);
    } catch (error) {
        return Promise.reject(error);
    }

}