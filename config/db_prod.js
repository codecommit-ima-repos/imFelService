const signInfileUrl = 'https://signer-emisores.feel.com.gt/sign_solicitud_firmas/firma_xml';
const registerInfileUrl = 'https://certificador.feel.com.gt/fel/certificacion/v2/dte/';
const cancelInfileUrl = 'https://certificador.feel.com.gt/fel/anulacion/v2/dte/';
const clientInfileUrl = 'https://consultareceptores.feel.com.gt/rest/action/';
const clientTokenInfileUrl = 'https://certificador.feel.com.gt/api/v2/servicios/externos/login';
const clientDPIInfileUrl = 'https://certificador.feel.com.gt/api/v2/servicios/externos/cui';

const tokenMegaprintUrl = 'https://apiv2.ifacere-fel.com/api/solicitarToken';
const signMegaprintUrl = 'https://api.soluciones-mega.com/api/solicitaFirma';
const registerMegaprintUrl = 'https://apiv2.ifacere-fel.com/api/registrarDocumentoXML';
const cancelMegaprintUrl = 'https://apiv2.ifacere-fel.com/api/anularDocumentoXML';
const clientMegaprintUrl = 'https://dev2.api.ifacere-fel.com/api/retornarDatosCliente';
const fileMegaprintUrl = 'https://apiv2.ifacere-fel.com/api/retornarPDF';

module.exports = {
    signInfileUrl,
    registerInfileUrl,
    cancelInfileUrl,
    clientInfileUrl,
    clientTokenInfileUrl,
    clientDPIInfileUrl,

    tokenMegaprintUrl,
    signMegaprintUrl,
    registerMegaprintUrl,
    cancelMegaprintUrl,
    clientMegaprintUrl,
    fileMegaprintUrl
};