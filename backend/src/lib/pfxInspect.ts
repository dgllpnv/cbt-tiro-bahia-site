import forge from 'node-forge';

// =====================================================
// pfxInspect — abre um certificado .pfx/.p12 com a senha informada e
// extrai metadados (titular/CN, validade, emissor) sem nenhuma chamada de
// rede — tudo local com node-forge (biblioteca open-source, gratuita).
//
// Usado na hora do upload em ClubDigitalSignature: alem de validar que a
// senha esta correta (lanca se estiver errada), preenche holderName e
// validUntil automaticamente a partir do certificado real, em vez do
// admin digitar isso na mao.
// =====================================================

export interface PfxInfo {
  holderName: string | null;
  validFrom: Date;
  validUntil: Date;
  issuer: string | null;
}

export function inspectPfx(p12Buffer: Buffer, password: string): PfxInfo {
  // node-forge trabalha com "binary string" (1 char = 1 byte) para DER.
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (bags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) {
    throw new Error('Nenhum certificado encontrado no arquivo');
  }
  const cert = certBag.cert;

  const cnField = cert.subject.getField('CN');
  const issuerField = cert.issuer.getField('CN');

  return {
    holderName: cnField?.value ?? null,
    validFrom: cert.validity.notBefore,
    validUntil: cert.validity.notAfter,
    issuer: issuerField?.value ?? null,
  };
}
