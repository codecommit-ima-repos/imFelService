

const config = require('../../../../config/db_' + process.env.stage);
const axios = require('axios');

module.exports.invoiceInfileCancel = async (event) => {
    try {
        console.log(JSON.stringify(event));
        const params = event.body;
        const cancelSignResponse = await cancelSign(params);
        if (cancelSignResponse.resultado == false) {
            return Promise.resolve(cancelSignResponse.descripcion);
        } else {
            const cancelRegisterResponse = await cancelRegister(params, cancelSignResponse);
            return Promise.resolve({ cancelSignResponse, cancelRegisterResponse });
        }
    } catch (error) {
        return Promise.reject(error);
    }
};

async function cancelSign(params) {
    try {
        const xml = await generateXML(params);
        const xmlBase64 = await convertBase64(xml);
        const headersCancelSign = await getHeadersCancelSign();
        const bodyCancelSign = await getBodyCancelSign(params, xmlBase64);
        const cancelSignInfile = await cancelSignInfileInvoice(headersCancelSign, bodyCancelSign);
        return Promise.resolve(cancelSignInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function generateXML(params) {
    try {
        const invoice = params.invoice;
        const transmitter = params.transmitter;
        const receiver = params.receiver;

        let xml = `<dte:GTAnulacionDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0" xmlns:n1="http://www.altova.com/samplexml/other-namespace" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1" xsi:schemaLocation="http://www.sat.gob.gt/dte/fel/0.1.0 C:\Users\User\Desktop\FEL\Esquemas\GT_AnulacionDocumento-0.1.0.xsd">
<dte:SAT>
<dte:AnulacionDTE ID="DatosCertificados">
<dte:DatosGenerales 
FechaEmisionDocumentoAnular="` + invoice.invoiceDate + `" 
FechaHoraAnulacion="` + new Date().toISOString().substring(0, 19) + `.000-06:00" 
ID="DatosAnulacion" IDReceptor="` + receiver.receiverTaxDocument + `" 
MotivoAnulacion="` + invoice.invoiceComment + `" NITEmisor="` + transmitter.transmitterTaxDocument + `" 
NumeroDocumentoAAnular="` + invoice.invoiceAuthorization + `"></dte:DatosGenerales>
</dte:AnulacionDTE>
</dte:SAT>
</dte:GTAnulacionDocumento>
`;
        xml = replaceAll(xml, '\n', '');
        return Promise.resolve(xml);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersCancelSign() {
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

async function getBodyCancelSign(params, xmlBase64) {
    try {
        const jsonInfile = {
            "llave": params.transmitter.transmitterToken,
            "archivo": xmlBase64,
            "codigo": params.invoice.invoiceCode,
            "alias": params.transmitter.transmitterPrefix,
            "es_anulacion": "S"
        };
        return Promise.resolve(jsonInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function cancelSignInfileInvoice(headers, body) {
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

async function cancelRegister(params, cancelSignResponse) {
    try {
        const headersCancelRegister = await getHeadersCancelRegister(params);
        const bodyCancelRegister = await getBodyCancelRegister(params, cancelSignResponse.archivo);
        const cancelRegisterInfile = await cancelRegisterInfileInvoice(headersCancelRegister, bodyCancelRegister);
        return Promise.resolve(cancelRegisterInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getHeadersCancelRegister(params) {
    try {
        let headers = {
            headers: {
                'Content-Type': 'application/json',
                'usuario': params.transmitter.transmitterPrefix,
                'llave': params.transmitter.transmitterKey,
                'identificador': params.invoice.invoiceCode
            }
        };
        return Promise.resolve(headers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function getBodyCancelRegister(params, xmlBase64) {
    try {
        const jsonInfile = {
            "nit_emisor": params.receiver.receiverTaxDocument,
            "correo_copia": "administrator@ima.com.gt",
            "xml_dte": xmlBase64
        };
        return Promise.resolve(jsonInfile);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function cancelRegisterInfileInvoice(headers, body) {
    try {
        const res = await axios.post(
            config.cancelInfileUrl,
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