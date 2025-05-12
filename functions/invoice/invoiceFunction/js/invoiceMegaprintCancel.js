const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const xml2js = require('xml2js');
const {
    v4: uuidv4
} = require('uuid');
const AxiosError = require('axios-error');

module.exports.invoiceMegaprintCancel = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const tokenResponse = await token(params);
        console.log(tokenResponse);
        if (tokenResponse.SolicitaTokenResponse.tipo_respuesta[0] == 0) {
            const token = tokenResponse.SolicitaTokenResponse.token[0];
            const cancelSignResponse = await cancelSign(params, token);
            console.log(JSON.stringify(cancelSignResponse));
            if (cancelSignResponse.cancelMegaprint.FirmaDocumentoResponse.tipo_respuesta[0] == 0) {
                const xmlStart = cancelSignResponse.cancelMegaprintXML.indexOf("<xml_dte>") + 9;
                const xmlEnd = cancelSignResponse.cancelMegaprintXML.indexOf("</xml_dte>");
                let xmlSubstring = cancelSignResponse.cancelMegaprintXML.substring(xmlStart, xmlEnd);
                xmlSubstring = replaceAll(xmlSubstring, '&lt;', '<');
                xmlSubstring = replaceAll(xmlSubstring, '&gt;', '>');
                xmlSubstring = replaceAll(xmlSubstring, '&amp;', '&');

                const cancelRegisterResponse = await cancelRegister(params, token, xmlSubstring);
                console.log(JSON.stringify(cancelRegisterResponse));
                if (cancelRegisterResponse.cancelMegaprint.AnulaDocumentoXMLResponse.tipo_respuesta[0] == 0) {
                    return Promise.resolve({
                        cancelSignResponse,
                        cancelRegisterResponse
                    });
                } else {
                    return Promise.reject('Registro Anular ' + cancelRegisterResponse.cancelMegaprint.AnulaDocumentoXMLResponse.listado_errores[0].error[0].desc_error[0]);
                }
            } else {
                return Promise.reject('Firma Anular' + cancelSignResponse.cancelMegaprint.FirmaDocumentoResponse.listado_errores[0].error[0].desc_error[0]);
            }
        } else {
            return Promise.reject('Token' + tokenResponse.SolicitaTokenResponse.listado_errores[0].error[0].desc_error[0]);
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

async function cancelSign(params, token) {
    try {
        const xml = await generateXML(params);
        // const xmlBase64 = await convertBase64(xml);
        const headersCancel = await getHeadersCancelSign(token);
        const bodyCancel = await getBodyCancelSign(params, xml);
        const cancelMegaprint = await cancelSignMegaprintInvoice(headersCancel, bodyCancel.body);
        return Promise.resolve({
            cancelMegaprint: cancelMegaprint.json,
            uuid: bodyCancel.uuid,
            cancelMegaprintXML: cancelMegaprint.xml
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function generateXML(params) {
    try {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns:GTAnulacionDocumento xmlns:ns="http://www.sat.gob.gt/dte/fel/0.1.0"  Version="0.1">
<ns:SAT>
<ns:AnulacionDTE ID="DatosCertificados">
<ns:DatosGenerales ID="DatosAnulacion" 
NumeroDocumentoAAnular="` + params.invoice.invoiceAuthorization + `" 
NITEmisor="` + params.transmitter.transmitterTaxDocument + `" 
IDReceptor="` + params.receiver.receiverTaxDocument + `" 
FechaEmisionDocumentoAnular="` + params.invoice.invoiceDate + `" 
FechaHoraAnulacion="` + new Date().toISOString().substring(0, 19) + `.000-06:00" 
MotivoAnulacion="` + params.invoice.invoiceComment + `" />
</ns:AnulacionDTE>
</ns:SAT>
</ns:GTAnulacionDocumento>`;
        xml = replaceAll(xml, '\n', '');
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersCancelSign(token) {
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

async function getBodyCancelSign(params, xml) {
    try {
        const uuid = uuidv4().toString().toUpperCase();

        let body = `<?xml version="1.0" encoding="UTF-8"?>
<FirmaDocumentoRequest id="` + uuid + `">
<xml_dte><![CDATA[` + xml + `]]></xml_dte>
</FirmaDocumentoRequest>
`;
        body = replaceAll(body, '\n', '');
        return Promise.resolve({
            body,
            uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function cancelSignMegaprintInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.signMegaprintUrl,
            body,
            headers
        );
        const response = await xml2js.parseStringPromise(res.data, {
            mergeAttrs: true
        });
        return Promise.resolve({
            json: response,
            xml: res.data
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function cancelRegister(params, token, xml) {
    try {

        const headersCancel = await getHeadersCancelRegister(token);
        const bodyCancel = await getBodyCancelRegister(params, xml);
        const cancelMegaprint = await cancelRegisterMegaprintInvoice(headersCancel, bodyCancel.body);
        return Promise.resolve({
            cancelMegaprint,
            uuid: bodyCancel.uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersCancelRegister(token) {
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

async function getBodyCancelRegister(params, xml) {
    try {
        const uuid = uuidv4().toString().toUpperCase();

        let body = `<?xml version="1.0" encoding="UTF-8"?>
<AnulaDocumentoXMLRequest id="` + uuid + `">
<xml_dte><![CDATA[` + xml + `]]></xml_dte>
</AnulaDocumentoXMLRequest>
`;
        // body = replaceAll(body, '\n', '');
        return Promise.resolve({
            body,
            uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function cancelRegisterMegaprintInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.cancelMegaprintUrl,
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