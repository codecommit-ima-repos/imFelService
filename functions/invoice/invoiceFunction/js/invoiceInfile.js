const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');

module.exports.invoiceInfile = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const signResponse = await sign(params);
        console.log(JSON.stringify(signResponse));
        if (signResponse.resultado == false) {
            return Promise.resolve(signResponse.descripcion);
        } else {
            const registerResponse = await register(params, signResponse);
            console.log(JSON.stringify(registerResponse));
            return Promise.resolve({
                signResponse,
                registerResponse
            });
        }
    } catch (error) {
        return Promise.reject(error);
    }
};

async function sign(params) {
    try {
        const xml = await generateXML(params);
        console.log(xml);
        const xmlBase64 = await convertBase64(xml);
        const headersSign = await getHeadersSign();
        const bodySign = await getBodySign(params, xmlBase64);
        const signInfile = await signInfileInvoice(headersSign, bodySign);
        return Promise.resolve(signInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function register(params, signInfile) {
    try {
        const headersRegister = await getHeadersRegister(params);
        const bodyRegister = await getBodyRegister(params, signInfile.archivo);
        const registerInfile = await registerInfileInvoice(headersRegister, bodyRegister);
        return Promise.resolve(registerInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersSign() {
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

async function convertBase64(xml) {
    try {
        let buff = new Buffer(xml);
        let base64data = buff.toString('base64');
        return Promise.resolve(base64data);
    } catch (error) {
        return Promise.reject(error);
    }

}

async function escapeAmpersand(value) {
    if (value && value.includes('&')) {
        return value.replace(/&/g, "&amp;");
    }
    return value;
}

async function generateXML(params) {
    try {
        const invoice = params.invoice;
        const transmitter = params.transmitter;
        const receiver = params.receiver;
        const details = params.detail;
        const phrases = params.phrase;
        const addendums = params.addendum;
        let addTypePersonality = '';
        let addResolution = '';

        transmitter.transmitterComercialName = await escapeAmpersand(transmitter.transmitterComercialName);
        transmitter.transmitterName = await escapeAmpersand(transmitter.transmitterName);

        let xmlDetail = ``;

        if (transmitter.transmitterType == 'RECI') {
            // addTypePersonality = `TipoPersoneria="` + transmitter.transmitterTypePersonality + `"`;
            addTypePersonality = (transmitter.transmitterTypePersonality && transmitter.transmitterTypePersonality !== 0)
              ? `TipoPersoneria="` + transmitter.transmitterTypePersonality + `"`
              : '';

            details.forEach((detail, index, arr) => {
                xmlDetail = xmlDetail + `
<dte:Item BienOServicio="` + detail.isService + `" NumeroLinea="` + (index + 1) + `">
<dte:Cantidad>` + detail.quantity + `</dte:Cantidad>
<dte:UnidadMedida>` + detail.measure + `</dte:UnidadMedida>
<dte:Descripcion>` + detail.description + `</dte:Descripcion>
<dte:PrecioUnitario>` + detail.unitPrice + `</dte:PrecioUnitario>
<dte:Precio>` + detail.price + `</dte:Precio>
<dte:Descuento>` + detail.discount + `</dte:Descuento>
<dte:Total>` + detail.total + `</dte:Total>
</dte:Item>`;
            });

        } else {

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
            });

        }

        let businessTax = '';

        if (transmitter.transmitterMembership !== 'PEQ' && transmitter.transmitterType !== 'RECI') {
            businessTax = `<dte:TotalImpuestos>
<dte:TotalImpuesto NombreCorto="` + invoice.invoiceTaxShortName + `" TotalMontoImpuesto="` + invoice.invoiceTaxValue + `" />
</dte:TotalImpuestos>`;

        }
        
        if ('transmitterResolution' in transmitter && transmitter.transmitterResolution == 1) {
            addResolution = `FechaResolucion="` + transmitter.transmitterResolutionDate + `" NumeroResolucion="` + transmitter.transmitterResolutionNumber + `"`;
        }

        let phrasesXml = '';
        if (phrases !== undefined) {
            if (phrases.length > 0) {
                phrases.forEach((phrase) => {
                    phrasesXml = phrasesXml + `<dte:Frase CodigoEscenario="` + phrase.phraseStage + `" TipoFrase="` + phrase.phrase + `" ` + addResolution + ` />`;
                });
            } else {
                phrasesXml = `<dte:Frase CodigoEscenario="` + transmitter.transmitterPhraseCode + `" TipoFrase="` + transmitter.transmitterPhraseType + `" ` + addResolution + ` />`;
            }
        } else {
            phrasesXml = `<dte:Frase CodigoEscenario="` + transmitter.transmitterPhraseCode + `" TipoFrase="` + transmitter.transmitterPhraseType + `" ` + addResolution + ` />`;
        }

        let date = new Date().toISOString().substring(0, 19);
        if (invoice.invoiceDate !== undefined) {
            date = new Date(invoice.invoiceDate).toISOString().substring(0, 19);
        }

        let addenda = '';
        if (addendums !== undefined) {
            if (addendums.length > 0) {
                addenda = `<dte:Adenda>`;
                addendums.forEach((addendum) => {
                    addenda = addenda + `<` + addendum.addendumKey + `>` + addendum.addendumValue + `</` + addendum.addendumKey + `>`;
                });
                addenda = addenda + `</dte:Adenda>`;
            }
        }

        let receiverInfo = `<dte:Receptor CorreoReceptor="` + receiver.receiverEmail + `" IDReceptor="` + receiver.receiverTaxDocument + `" NombreReceptor="` + receiver.receiverName + `">`;
        if (receiver.receiverSpecialType != undefined) {
            receiverInfo = `<dte:Receptor CorreoReceptor="` + receiver.receiverEmail + `" IDReceptor="` + receiver.receiverIdentificationDocument + `" NombreReceptor="` + receiver.receiverName + `" TipoEspecial="CUI">`;
        }

        receiver.receiverMunicipality = receiver.receiverMunicipality == undefined ? '' : receiver.receiverMunicipality;
        receiver.receiverDepartment = receiver.receiverDepartment == undefined ? '' : receiver.receiverDepartment;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
<dte:SAT ClaseDocumento="dte">
<dte:DTE ID="DatosCertificados">
<dte:DatosEmision ID="DatosEmision">
<dte:DatosGenerales CodigoMoneda="` + invoice.invoiceCurrency + `" FechaHoraEmision="` + date + `.000-06:00" Tipo="` + transmitter.transmitterType + `" ` + addTypePersonality + `/>
<dte:Emisor AfiliacionIVA="` + transmitter.transmitterMembership + `" CodigoEstablecimiento="` + transmitter.transmitterEstablishmentCode + `" CorreoEmisor="` + transmitter.transmitterEmail + `" NITEmisor="` + transmitter.transmitterTaxDocument + `" NombreComercial="` + transmitter.transmitterComercialName + `" NombreEmisor="` + transmitter.transmitterName + `">
<dte:DireccionEmisor>
<dte:Direccion>` + transmitter.transmitterAddress + `</dte:Direccion>
<dte:CodigoPostal>` + transmitter.transmitterZipCode + `</dte:CodigoPostal>
<dte:Municipio>` + transmitter.transmitterMunicipality + `</dte:Municipio>
<dte:Departamento>` + transmitter.transmitterDepartment + `</dte:Departamento>
<dte:Pais>` + transmitter.transmitterCountry + `</dte:Pais>
</dte:DireccionEmisor>
</dte:Emisor>`+ receiverInfo + `<dte:DireccionReceptor>
<dte:Direccion>` + receiver.receiverAddress + `</dte:Direccion>
<dte:CodigoPostal>` + receiver.receiverZipCode + `</dte:CodigoPostal>
<dte:Municipio>` + receiver.receiverMunicipality + `</dte:Municipio>
<dte:Departamento>` + receiver.receiverDepartment + `</dte:Departamento>
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
<dte:GranTotal>` + invoice.invoiceTotal + `</dte:GranTotal>
</dte:Totales>
</dte:DatosEmision>
</dte:DTE>` + addenda +
            `</dte:SAT>
</dte:GTDocumento>
`;
        xml = replaceAll(xml, '\n', '');
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodySign(params, xmlBase64) {
    try {
        const jsonInfile = {
            "llave": params.transmitter.transmitterToken,
            "archivo": xmlBase64,
            "codigo": 'FACT' + params.invoice.invoiceCode,
            "alias": params.transmitter.transmitterPrefix,
            "es_anulacion": "N"
        };
        return Promise.resolve(jsonInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function signInfileInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.signInfileUrl,
            body,
            headers
        );
        return Promise.resolve(res.data);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersRegister(params) {
    try {
        let headers = {
            headers: {
                'Content-Type': 'application/json',
                'usuario': params.transmitter.transmitterPrefix,
                'llave': params.transmitter.transmitterKey,
                'identificador': 'FACT' + params.invoice.invoiceCode,
            }
        };
        return Promise.resolve(headers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyRegister(params, xmlBase64) {
    try {
        const jsonInfile = {
            "nit_emisor": params.transmitter.transmitterTaxDocument,
            "correo_copia": "administrator@ima.com.gt",
            "xml_dte": xmlBase64
        };
        return Promise.resolve(jsonInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function registerInfileInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.registerInfileUrl,
            body,
            headers
        );
        return Promise.resolve(res.data);
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