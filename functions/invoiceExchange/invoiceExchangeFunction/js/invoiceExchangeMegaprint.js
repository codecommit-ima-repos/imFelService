const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');
const xml2js = require('xml2js');
const {
    v4: uuidv4
} = require('uuid');
const AxiosError = require('axios-error');

module.exports.invoiceExchangeMegaprint = async (event) => {
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
                    const jsonXml = await xml2js.parseStringPromise(registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.xml_dte[0], {
                        mergeAttrs: true
                    });
                    const pdfBase64 = await getPdfMegaprint(token, params, registerResponse.registerMegaprint.RegistraDocumentoXMLResponse.uuid[0]);
                    console.log(pdfBase64);
                    if (pdfBase64.RetornaPDFResponse.tipo_respuesta[0] == 0) {
                        return Promise.resolve({
                            signResponse,
                            registerResponse,
                            jsonXml,
                            pdfBase64
                        });
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

async function sign(params, token) {
    try {
        const xml = await generateXML(params);
        // const xmlBase64 = await convertBase64(xml);
        const headersSign = await getHeadersSign(token);
        const bodySign = await getBodySign(params, xml);
        const signMegaprint = await signMegaprintInvoice(headersSign, bodySign.body);
        return Promise.resolve({
            signMegaprint,
            uuid: bodySign.uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function generateXML(params) {
    try {
        const invoiceExchange = params.invoiceExchange;
        const transmitter = params.transmitter;
        const receiver = params.receiver;
        const details = params.detail;
        const phrases = params.phrase;
        const detailsComplement = params.detailsComplement;

        let xmlDetail = ``;
        let xmlDetailComplement = ``;
        let addendumItemXml = '';

        details.forEach((detail, index, arr) => {
            xmlDetail = xmlDetail + `
            <dte:Item BienOServicio="` + detail.isService + `" NumeroLinea="` + (index + 1) + `">
                <dte:Cantidad>` + detail.quantity + `</dte:Cantidad>
                <dte:UnidadMedida>` + detail.measure + `</dte:UnidadMedida>
                <dte:Descripcion>` + detail.description + `</dte:Descripcion>
                <dte:PrecioUnitario>` + detail.unitPrice + `</dte:PrecioUnitario>
                <dte:Precio>` + detail.price + `</dte:Precio>
                <dte:Descuento>` + detail.discount + `</dte:Descuento>
                <dte:Impuestos>
                <dte:Impuesto>
                <dte:NombreCorto>` + detail.taxName + `</dte:NombreCorto>
                <dte:CodigoUnidadGravable>` + detail.taxCode + `</dte:CodigoUnidadGravable>
                <dte:MontoGravable>` + detail.taxableAmount + `</dte:MontoGravable>
                <dte:MontoImpuesto>` + detail.taxAmount + `</dte:MontoImpuesto>
                </dte:Impuesto>
                </dte:Impuestos>
                <dte:Total>` + detail.total + `</dte:Total>
            </dte:Item>`;

            if (detail.addendum != undefined) {
                addendumItemXml += `
                            <dte:AdendaItem LineaReferencia="` + (index + 1) + `">
                                <dte:Valor1>` + detail.addendum.valor1 + `</dte:Valor1>
                            </dte:AdendaItem>`;
            }
        });

        detailsComplement.forEach((detail, index, arr) => {
            xmlDetailComplement = xmlDetailComplement + `
                <cfc:Abono>
                    <cfc:NumeroAbono>` + detail.invoiceExchangeSubscriptionNumber + `</cfc:NumeroAbono>
                    <cfc:FechaVencimiento>` + detail.invoiceExchangeSubscriptionDate + `</cfc:FechaVencimiento>
                    <cfc:MontoAbono>` + detail.invoiceExchangeSubscriptionAmount + `</cfc:MontoAbono>
                </cfc:Abono>`;
        });

        let businessTax = '';

        if (transmitter.transmitterMembership !== 'PEQ') {
            businessTax = `<dte:TotalImpuestos>
<dte:TotalImpuesto NombreCorto="` + invoiceExchange.invoiceExchangeTaxShortName + `" TotalMontoImpuesto="` + invoiceExchange.invoiceExchangeTaxValue + `" />
</dte:TotalImpuestos>`;

        }

        let walmartXml = '';
        if (params.walmart != undefined) {
            const walmart = params.walmart;
            walmartXml += `<wmdte:Walmart xmlns:wmdte="http://walmart.com.gt/dte" version="1.2">
                                <wmdte:WM-FACT>
                                    <wmdte:WMMercaderia>
                                        <wmdte:WMNumeroVendedor>` + walmart.WMNumeroVendedor + `</wmdte:WMNumeroVendedor>
                                        <wmdte:WMNumeroOrden>` + walmart.WMNumeroOrden + `</wmdte:WMNumeroOrden>
                                        <wmdte:WMEnviarGLN>` + walmart.WMEnviarGLN + `</wmdte:WMEnviarGLN>
                                        <wmdte:WMNumeroRecepcion>` + walmart.WMNumeroRecepcion + `</wmdte:WMNumeroRecepcion>
                                        <wmdte:WMFechaOrden>` + walmart.WMFechaOrden + `</wmdte:WMFechaOrden>
                                    </wmdte:WMMercaderia>
                                </wmdte:WM-FACT>
                            </wmdte:Walmart>`;
        }

        //Adendas Sylvania
        let addendumXml = '';
        if (params.addendum != undefined) {
            const addendum = params.addendum;
            addendumXml += `<dte:Adenda>
                <dte:AdendaDetail ID="AdendaSummary">
                    <dte:AdendaSummary>
                        <dte:Valor1>` + addendum.valor1 + `13262</dte:Valor1>
                        <dte:Valor2>` + addendum.valor2 + `</dte:Valor2>
                        <dte:Valor3>` + addendum.valor3 + `</dte:Valor3>
                        <dte:Valor4>` + addendum.valor4 + `</dte:Valor4>
                        <dte:Valor5>` + addendum.valor5 + `</dte:Valor5>
                        <dte:Valor6>` + addendum.valor6 + `</dte:Valor6>
                        <dte:Valor7>` + addendum.valor7 + `</dte:Valor7>
                        <dte:Valor8>` + addendum.valor8 + `</dte:Valor8>
                        <dte:Valor9>` + addendum.valor9 + `</dte:Valor9>
                        <dte:Valor10>` + addendum.valor10 + `</dte:Valor10>
                        <dte:Valor11>` + addendum.valor11 + `</dte:Valor11>
                        <dte:Valor12>` + addendum.valor12 + `</dte:Valor12>
                        <dte:Valor13>` + addendum.valor13 + `</dte:Valor13>
                        <dte:Valor14>` + addendum.valor14 + `</dte:Valor14>
                        <dte:Valor15>` + addendum.valor15 + `</dte:Valor15>
                        <dte:Valor16>` + addendum.valor16 + `</dte:Valor16>
                        <dte:Valor17>` + addendum.valor17 + `</dte:Valor17>
                        <dte:Valor18>` + addendum.valor18 + `</dte:Valor18>
                        <dte:Valor19>` + addendum.valor19 + `</dte:Valor19>
                        <dte:Valor20>` + addendum.valor20 + `</dte:Valor20>
                        <dte:Valor21>` + addendum.valor21 + `</dte:Valor21>
                        <dte:Valor23>` + addendum.valor23 + `</dte:Valor23>
                    </dte:AdendaSummary>
                    <dte:AdendaItems>` +
                addendumItemXml +
                `</dte:AdendaItems>
                </dte:AdendaDetail>` +
                walmartXml +
                `</dte:Adenda>`;
        } else {
            addendumItemXml += '';
        }


        let phrasesXml = '';
        if (phrases !== undefined) {
            if (phrases.length > 0) {
                phrases.forEach((phrase) => {
                    phrasesXml = phrasesXml + `<dte:Frase CodigoEscenario="` + phrase.phraseStage + `" TipoFrase="` + phrase.phrase + `" />`;
                });
            } else {
                phrasesXml = `<dte:Frase CodigoEscenario="` + transmitter.transmitterPhraseCode + `" TipoFrase="` + transmitter.transmitterPhraseType + `" />`;
            }
        } else {
            phrasesXml = `<dte:Frase CodigoEscenario="` + transmitter.transmitterPhraseCode + `" TipoFrase="` + transmitter.transmitterPhraseType + `" />`;
        }


        let date = new Date().toISOString().substring(0, 19);
        if (invoiceExchange.invoiceExchangeDate !== undefined) {
            date = new Date(invoiceExchange.invoiceExchangeDate).toISOString().substring(0, 19);
        }
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
<dte:SAT ClaseDocumento="dte">
<dte:DTE ID="DatosCertificados">
<dte:DatosEmision ID="DatosEmision">
<dte:DatosGenerales CodigoMoneda="` + invoiceExchange.invoiceExchangeCurrency + `" FechaHoraEmision="` + date + `.000-06:00" Tipo="` + transmitter.transmitterType + `" />
<dte:Emisor AfiliacionIVA="` + transmitter.transmitterMembership + `" CodigoEstablecimiento="` + transmitter.transmitterEstablishmentCode + `" CorreoEmisor="` + transmitter.transmitterEmail + `" NITEmisor="` + transmitter.transmitterTaxDocument + `" NombreComercial="` + transmitter.transmitterComercialName + `" NombreEmisor="` + transmitter.transmitterName + `">
<dte:DireccionEmisor>
<dte:Direccion>` + transmitter.transmitterAddress + `</dte:Direccion>
<dte:CodigoPostal>` + transmitter.transmitterZipCode + `</dte:CodigoPostal>
<dte:Municipio>` + transmitter.transmitterMunicipality + `</dte:Municipio>
<dte:Departamento>` + transmitter.transmitterDepartment + `</dte:Departamento>
<dte:Pais>` + transmitter.transmitterCountry + `</dte:Pais>
</dte:DireccionEmisor>
</dte:Emisor>
<dte:Receptor CorreoReceptor="` + receiver.receiverEmail + `" IDReceptor="` + receiver.receiverTaxDocument + `" NombreReceptor="` + receiver.receiverName + `">
<dte:DireccionReceptor>
<dte:Direccion>` + receiver.receiverAddress + `</dte:Direccion>
<dte:CodigoPostal>` + receiver.receiverZipCode + `</dte:CodigoPostal>
<dte:Municipio />
<dte:Departamento />
<dte:Pais>` + receiver.receiverCountry + `</dte:Pais>
</dte:DireccionReceptor>
</dte:Receptor>
<dte:Frases>
` + phrasesXml + ` 
</dte:Frases>
<dte:Items>
` + xmlDetail + `
</dte:Items>
<dte:Totales>
` + businessTax + `
<dte:GranTotal>` + invoiceExchange.invoiceExchangeTotal + `</dte:GranTotal>
</dte:Totales>
<dte:Complementos>
<dte:Complemento IDComplemento="` + invoiceExchange.invoiceExchangeComplementId + `" NombreComplemento="` + invoiceExchange.invoiceExchangeComplementName + `" URIComplemento="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0">
<cfc:AbonosFacturaCambiaria xmlns:cfc="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0" Version="1">
` + xmlDetailComplement + `
</cfc:AbonosFacturaCambiaria>
</dte:Complemento>
</dte:Complementos>
</dte:DatosEmision>
</dte:DTE>` +
            addendumXml +
            `</dte:SAT>
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
        console.log(body);
        body = replaceAll(body, '\n', '');
        return Promise.resolve({
            body,
            uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function signMegaprintInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.signMegaprintUrl,
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

async function register(params, token, signMegaprint) {
    try {
        const headersRegister = await getHeadersRegister(params, token);
        const bodyRegister = await getBodyRegister(params, signMegaprint);
        const registerMegaprint = await registerMegaprintInvoice(headersRegister, bodyRegister.body);
        return Promise.resolve({
            registerMegaprint,
            uuid: bodyRegister.uuid
        });
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
        return Promise.resolve({
            body,
            uuid
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function registerMegaprintInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.registerMegaprintUrl,
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
        const res = await axios.post(
            config.fileMegaprintUrl,
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