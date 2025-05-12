

const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

module.exports.creditNoteMegaprint = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const tokenResponse = await token(params);
        console.log(tokenResponse);
        if (tokenResponse.SolicitaTokenResponse.tipo_respuesta[0] == 0) {
            const token = tokenResponse.SolicitaTokenResponse.token[0];
            console.log(token);
            const signResponse = await sign(params, token);
            console.log(signResponse);
            if (signResponse.signMegaprint.FirmaDocumentoResponse.tipo_respuesta[0] == 0) {
                const registerResponse = await register(params, token, signResponse.signMegaprint.FirmaDocumentoResponse.xml_dte[0]);
                console.log(registerResponse);
                if (registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.tipo_respuesta[0] == 0) {
                    const jsonXml = await xml2js.parseStringPromise(registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.xml_dte[0], { mergeAttrs: true });
                    const pdfBase64 = await getPdfMegaprint(token, params, registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.uuid[0]);
                    console.log(pdfBase64);
                    if (pdfBase64.RetornaPDFResponse.tipo_respuesta[0] == 0) {
                        return Promise.resolve({ signResponse, registerResponse, jsonXml, pdfBase64 });
                    } else {
                        return Promise.reject('PDF ' + pdfBase64.RetornaPDFResponse.listado_errores[0].error[0].desc_error[0]);
                    }
                } else {
                    return Promise.reject('Registro' + registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.listado_errores[0].error[0].desc_error[0]);
                }
            } else {
                return Promise.reject('Firma' + signResponse.signMegaprint.FirmaDocumentoResponse.listado_errores[0].error[0].desc_error[0]);
            }
        } else {
            return Promise.reject('Token' + tokenResponse.SolicitaTokenResponse.listado_errores[0].error[0].desc_error[0]);
        }
    } catch (error) {
        return Promise.reject('Fail ' + error);
    }
};

async function token(params) {
    try {
        const headersToken = await getHeadersToken();
        const bodyToken = await getBodyToken(params);
        const tokenMegaprint = await tokenMegaprintCreditNote(headersToken, bodyToken);
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

async function tokenMegaprintCreditNote(headers, body) {
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

async function sign(params, token) {
    try {
        const xml = await generateXML(params);
        // const xmlBase64 = await convertBase64(xml);
        const headersSign = await getHeadersSign(token);
        const bodySign = await getBodySign(params, xml);
        const signMegaprint = await signMegaprintCreditNote(headersSign, bodySign.body);
        return Promise.resolve({ signMegaprint, uuid: bodySign.uuid });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function generateXML(params) {
    try {
        const creditNote = params.creditNote;
        const transmitter = params.transmitter;
        const receiver = params.receiver;
        const details = params.detail;

        let xmlDetail = ``;

        details.forEach((detail, index, arr) => {
            xmlDetail = xmlDetail + `
<dte:Item BienOServicio="`+ detail.isService + `" NumeroLinea="` + (index + 1) + `">
<dte:Cantidad>`+ detail.quantity + `</dte:Cantidad>
<dte:UnidadMedida>`+ detail.measure + `</dte:UnidadMedida>
<dte:Descripcion>`+ detail.description + `</dte:Descripcion>
<dte:PrecioUnitario>`+ detail.unitPrice + `</dte:PrecioUnitario>
<dte:Precio>`+ detail.price + `</dte:Precio>
<dte:Descuento>`+ detail.discount + `</dte:Descuento>
<dte:Impuestos>
<dte:Impuesto>
<dte:NombreCorto>`+ detail.taxName + `</dte:NombreCorto>
<dte:CodigoUnidadGravable>`+ detail.taxCode + `</dte:CodigoUnidadGravable>
<dte:MontoGravable>`+ detail.taxableAmount + `</dte:MontoGravable>
<dte:MontoImpuesto>`+ detail.taxAmount + `</dte:MontoImpuesto>
</dte:Impuesto>
</dte:Impuestos>
<dte:Total>`+ detail.total + `</dte:Total>
</dte:Item>`;
        });

        let businessTax = '';

        if (transmitter.transmitterMembership !== 'PEQ') {
            businessTax = `<dte:TotalImpuestos>
<dte:TotalImpuesto NombreCorto="`+ creditNote.creditNoteTaxShortName + `" TotalMontoImpuesto="` + creditNote.creditNoteTaxValue + `" />
</dte:TotalImpuestos>`;

        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
<dte:SAT ClaseDocumento="dte">
<dte:DTE ID="DatosCertificados">
<dte:DatosEmision ID="DatosEmision">
<dte:DatosGenerales CodigoMoneda="` + creditNote.creditNoteCurrency + `" FechaHoraEmision="` + new Date().toISOString().substring(0, 19) + `.000-06:00" Tipo="` + transmitter.transmitterType + `" />
<dte:Emisor AfiliacionIVA="` + transmitter.transmitterMembership + `" CodigoEstablecimiento="` + transmitter.transmitterEstablishmentCode + `" CorreoEmisor="` + transmitter.transmitterEmail + `" NITEmisor="` + transmitter.transmitterTaxDocument + `" NombreComercial="` + transmitter.transmitterComercialName + `" NombreEmisor="` + transmitter.transmitterName + `">
<dte:DireccionEmisor>
<dte:Direccion>` + transmitter.transmitterAddress + `</dte:Direccion>
<dte:CodigoPostal>` + transmitter.transmitterZipCode + `</dte:CodigoPostal>
<dte:Municipio>` + transmitter.transmitterMunicipality + `</dte:Municipio>
<dte:Departamento>` + transmitter.transmitterDepartment + `</dte:Departamento>
<dte:Pais>` + transmitter.transmitterCountry + `</dte:Pais>
</dte:DireccionEmisor>
</dte:Emisor>
<dte:Receptor CorreoReceptor="`+ receiver.receiverEmail + `" IDReceptor="` + receiver.receiverTaxDocument + `" NombreReceptor="` + receiver.receiverName + `">
<dte:DireccionReceptor>
<dte:Direccion>`+ receiver.receiverAddress + `</dte:Direccion>
<dte:CodigoPostal>`+ receiver.receiverZipCode + `</dte:CodigoPostal>
<dte:Municipio />
<dte:Departamento />
<dte:Pais>`+ receiver.receiverCountry + `</dte:Pais>
</dte:DireccionReceptor>
</dte:Receptor>
<dte:Items>
` + xmlDetail + `
</dte:Items>
<dte:Totales>
` + businessTax + `
<dte:GranTotal>` + creditNote.creditNoteTotal + `</dte:GranTotal>
</dte:Totales>
<dte:Complementos>
<dte:Complemento IDComplemento="` + creditNote.creditNoteComplementId + `" NombreComplemento="` + creditNote.creditNoteComplementName + `" URIComplemento="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0">
<cno:ReferenciasNota xmlns:cno="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0" FechaEmisionDocumentoOrigen="` + creditNote.creditNoteSourceDocumentIssuanceDate + `" MotivoAjuste="` + creditNote.creditNoteFitMotif + `" NumeroAutorizacionDocumentoOrigen="` + creditNote.creditNoteOrigialDocumentAuthorizationNumber + `" Version="1"/>
</dte:Complemento>
</dte:Complementos>
</dte:DatosEmision>
</dte:DTE>
</dte:SAT>
</dte:GTDocumento>
`;
        xml = replaceAll(xml, '\n', '');
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersSign(token) {
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

async function getBodySign(params, xml) {
    try {
        const uuid = uuidv4().toString().toUpperCase();

        let body = `<?xml version="1.0" encoding="UTF-8"?>
<FirmaDocumentoRequest id="` + uuid + `">
<xml_dte><![CDATA[` + xml + `]]></xml_dte>
</FirmaDocumentoRequest>
`;
        body = replaceAll(body, '\n', '');
        return Promise.resolve({ body, uuid });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function signMegaprintCreditNote(headers, body) {
    try {
        const res = await axios.post(
            config.signMegaprintUrl,
            body,
            headers
        );
        const response = await xml2js.parseStringPromise(res.data, { mergeAttrs: true });
        return Promise.resolve(response);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function register(params, token, signMegaprint) {
    try {
        const headersRegister = await getHeadersRegister(params, token);
        const bodyRegister = await getBodyRegister(params, signMegaprint);
        const registerMegaprint = await registerMegaprintCreditNote(headersRegister, bodyRegister.body);
        return Promise.resolve({ registerMegaprint, uuid: bodyRegister.uuid });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersRegister(params, token) {
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

async function getBodyRegister(params, xml) {
    try {

        const uuid = uuidv4().toString().toUpperCase();

        let body = `<?xml version='1.0' encoding='UTF-8'?>
<RegistraDocumentoXMLRequest id="` + uuid + `">
<xml_dte><![CDATA[ ` + xml + ` ]]></xml_dte>
</RegistraDocumentoXMLRequest>
`;
        // body = replaceAll(body, '\n', '');
        return Promise.resolve({ body, uuid });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function registerMegaprintCreditNote(headers, body) {
    try {
        const res = await axios.post(
            config.registerMegaprintUrl,
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

async function getPdfMegaprint(token, params, authUuid) {
    try {
        const header = await getHeadersPdf(token);
        const body = await getBodyPdf(params, authUuid);
        const pdfMegaprint = await pdfMegaprintCreditNote(header, body);
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

async function pdfMegaprintCreditNote(headers, body) {
    try {
        console.log(body)
        const res = await axios.post(
            config.fileMegaprintUrl,
            body,
            headers
        );
        console.log(res)
        const response = await xml2js.parseStringPromise(res.data, { mergeAttrs: true });
        return Promise.resolve(response);
    } catch (error) {
        return Promise.reject(error);
    }

}