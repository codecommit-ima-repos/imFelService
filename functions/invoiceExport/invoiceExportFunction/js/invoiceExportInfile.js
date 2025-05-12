

const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');

module.exports.invoiceExportInfile = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const signResponse = await sign(params);
        if (signResponse.resultado == false) {
            return Promise.resolve(signResponse.descripcion);
        } else {
            const registerResponse = await register(params, signResponse);
            return Promise.resolve({ signResponse, registerResponse });
        }
    } catch (error) {
        return Promise.reject(error);
    }
};

async function sign(params) {
    try {
        const xml = await generateXML(params);
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

async function generateXML(params) {
    try {
        const invoiceExport = params.invoiceExport;
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
<dte:TotalImpuesto NombreCorto="`+ invoiceExport.invoiceExportTaxShortName + `" TotalMontoImpuesto="` + invoiceExport.invoiceExportTaxValue + `" />
</dte:TotalImpuestos>`;

        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
<dte:SAT ClaseDocumento="dte">
<dte:DTE ID="DatosCertificados">
<dte:DatosEmision ID="DatosEmision">
<dte:DatosGenerales CodigoMoneda="` + invoiceExport.invoiceExportCurrency + `" Exp="SI" FechaHoraEmision="` + new Date().toISOString().substring(0, 19) + `.000-06:00" Tipo="` + transmitter.transmitterType + `" />
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
<dte:Frases>
<dte:Frase CodigoEscenario="`+ transmitter.transmitterPhraseCode + `" TipoFrase="` + transmitter.transmitterPhraseType + `" />
<dte:Frase CodigoEscenario="1" TipoFrase="4"></dte:Frase>
</dte:Frases>
<dte:Items>
` + xmlDetail + `
</dte:Items>
<dte:Totales>
` + businessTax + `
<dte:GranTotal>` + invoiceExport.invoiceExportTotal + `</dte:GranTotal>
</dte:Totales>
<dte:Complementos>
<dte:Complemento IDComplemento="` + invoiceExport.invoiceExportComplementId + `" NombreComplemento="` + invoiceExport.invoiceExportComplementName + `" URIComplemento="http://www.sat.gob.gt/fel/exportacion.xsd">
<cex:Exportacion xmlns:cex="http://www.sat.gob.gt/face2/ComplementoExportaciones/0.1.0" Version="1" >
<cex:NombreConsignatarioODestinatario>` + invoiceExport.invoiceExportNameConsignee + `</cex:NombreConsignatarioODestinatario>
<cex:DireccionConsignatarioODestinatario>` + invoiceExport.invoiceExportAddressConsignee + `</cex:DireccionConsignatarioODestinatario>
<cex:CodigoConsignatarioODestinatario>` + invoiceExport.invoiceExportCodeConsignee + `</cex:CodigoConsignatarioODestinatario>
<cex:NombreComprador>` + invoiceExport.invoiceExportBuyerName + `</cex:NombreComprador>
<cex:DireccionComprador>` + invoiceExport.invoiceExportBuyerAddress + `</cex:DireccionComprador>
<cex:CodigoComprador>` + invoiceExport.invoiceExportBuyerCode + `</cex:CodigoComprador>
<cex:OtraReferencia>` + invoiceExport.invoiceExportOtherRef + `</cex:OtraReferencia>
<cex:INCOTERM>` + invoiceExport.invoiceExportINCOTERM + `</cex:INCOTERM>
<cex:NombreExportador>` + invoiceExport.invoiceExportExportName + `</cex:NombreExportador>
<cex:CodigoExportador>` + invoiceExport.invoiceExportExportCode + `</cex:CodigoExportador>
</cex:Exportacion>
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

async function getBodySign(params, xmlBase64) {
    try {
        const jsonInfile = {
            "llave": params.transmitter.transmitterToken,
            "archivo": xmlBase64,
            "codigo": 'FACTEXP' + params.invoiceExport.invoiceExportCode,
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
                'identificador': params.invoiceExport.invoiceExportCode,
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



