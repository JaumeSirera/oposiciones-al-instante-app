import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center text-blue-600">
              Política de Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            
            <Section title="1. Introducción">
              <p>
                oposiciones-test.com se compromete a proteger y respetar su privacidad.
                Esta política de privacidad explica cómo recopilo, utilizo y protejo la
                información personal que obtengo a través de la aplicación.
              </p>
            </Section>

            <Section title="2. Información que Recopilamos">
              <p>Puedo recopilar y procesar la siguiente información personal:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nombre y apellidos</li>
                <li>Dirección de correo electrónico</li>
                <li>Información de contacto, incluyendo número de teléfono</li>
                <li>Información demográfica, como código postal</li>
                <li>Datos de uso de la aplicación</li>
                <li>Contenido que usted introduce para funciones de IA (por ejemplo, textos/preguntas y, si procede, archivos)</li>
                <li>Respuestas generadas por la IA y metadatos técnicos de la operación (p. ej., identificadores de solicitud, información de registro del dispositivo/cliente)</li>
              </ul>
            </Section>

            <Section title="3. Uso de la Información">
              <p>
                Utilizo la información recopilada solo para uso interno de la APP, nunca para segundos,
                terceros o cualquier otros propósitos:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Proveer los servicios y productos</li>
                <li>Personalizar el contenido</li>
                <li>Mejorar la aplicación</li>
                <li>Envío de boletines y promociones, solo referentes a la APP</li>
                <li>Realizar análisis y estudios de mercado propios</li>
                <li>Nunca se transferirán sus datos a terceros, conscientemente</li>
              </ul>
            </Section>

            <Section title="4. Protección de Datos y uso de IA (Google Gemini)">
              <p>
                Implemento medidas técnicas y organizativas adecuadas para proteger sus datos personales
                contra el acceso no autorizado, la alteración, la divulgación o la destrucción. Cumplo con las
                obligaciones de seguridad impuestas por el RGPD y la LOPDGDD.
              </p>

              <p className="mt-4">
                <strong className="text-blue-600">Uso de IA (Google Gemini).</strong> En determinadas funcionalidades, la APP utiliza
                servicios de inteligencia artificial prestados por Google Gemini. En este tratamiento, <strong>oposiciones-test.com</strong> actúa como <strong>responsable del tratamiento</strong> y <strong>Google LLC</strong> actúa como <strong>encargado del tratamiento</strong>, con arreglo a su Acuerdo de Tratamiento de Datos (DPA).
              </p>

              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li><strong>Finalidad:</strong> prestar las funciones de IA (p. ej., generación de técnicas de memorización, resúmenes o análisis de contenido) y garantizar la seguridad/prevención de abusos del servicio.</li>
                <li><strong>Categorías de datos tratados por Google:</strong> el contenido que usted envíe para estas funciones (entradas) y las salidas generadas, junto con metadatos técnicos necesarios para la prestación del servicio.</li>
                <li><strong>Base jurídica:</strong> ejecución del contrato/servicio; y, cuando corresponda, su consentimiento.</li>
                <li><strong>Conservación:</strong> por defecto, Google puede conservar durante un periodo breve ciertos registros orientados a seguridad/abuso y luego eliminarlos, salvo obligación legal de conservación.</li>
                <li><strong>Entrenamiento de modelos:</strong> los datos enviados a través de la <strong>API</strong> de Google Gemini <strong>no se utilizan por defecto</strong> para entrenar sus modelos comerciales.</li>
                <li><strong>Transferencias internacionales:</strong> el tratamiento puede implicar transferencias a EE. UU. u otros países, aplicándose las <strong>Cláusulas Contractuales Tipo (SCC)</strong> y otras garantías del DPA.</li>
                <li><strong>Seguridad:</strong> cifrado en tránsito y en reposo y controles auditados (p. ej., certificaciones ISO 27001, SOC 2).</li>
                <li><strong>Subencargados:</strong> Google puede utilizar subprocesadores conforme a su DPA. Puede solicitar información adicional.</li>
              </ul>

              <p className="mt-4">
                El responsable limita las instrucciones a Google a la mera prestación del servicio, sin autorizar su
                uso para fines propios, y exige la supresión conforme a los plazos indicados. Puede solicitar más
                detalles o copia de las garantías aplicables escribiendo a <strong className="text-blue-600">contacto@oposiciones-test.com</strong>.
              </p>
            </Section>

            <Section title="5. Derechos del Usuario">
              <p>
                Usted tiene derecho a acceder, rectificar, suprimir, oponerse y limitar el tratamiento de sus datos personales.
                También puede retirar su consentimiento en cualquier momento. Para ejercer estos derechos, puede ponerse en
                contacto conmigo en <strong className="text-blue-600">contacto@oposiciones-test.com</strong>.
              </p>
            </Section>

            <Section title="6. Cookies">
              <p>
                La aplicación puede utilizar cookies o tecnologías similares para mejorar la experiencia del usuario.
                Puede configurar su dispositivo para rechazar cookies, aunque esto puede afectar la funcionalidad.
              </p>
            </Section>

            <Section title="7. Cambios en la Política de Privacidad">
              <p>
                Me reservo el derecho de actualizar esta política de privacidad en cualquier momento. Cualquier cambio será
                publicado en esta página y, cuando corresponda, notificado por correo electrónico.
              </p>
            </Section>

            <Section title="8. Contacto">
              <p>
                Si tiene alguna pregunta sobre esta política de privacidad o sobre cómo manejo su información personal,
                puede contactarme en:
              </p>
              <p className="font-bold text-blue-600">contacto@oposiciones-test.com</p>
            </Section>

            <Section title="9. Base jurídica y plazos">
              <p>Trato sus datos personales conforme a las siguientes bases jurídicas del RGPD:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Ejecución del contrato</strong> (art. 6.1.b): para prestar la APP y sus funcionalidades.</li>
                <li><strong>Consentimiento</strong> (art. 6.1.a): para comunicaciones comerciales propias y para funciones de IA que usted active de forma opcional, cuando proceda.</li>
                <li><strong>Interés legítimo</strong> (art. 6.1.f): seguridad del servicio, prevención del fraude y mejora de la calidad, siempre ponderando sus derechos.</li>
                <li><strong>Cumplimiento de obligaciones legales</strong> (art. 6.1.c): atención de derechos, requisitos fiscales/contables y otras obligaciones aplicables.</li>
              </ul>
              <p className="mt-4">
                Los datos se conservarán mientras sean necesarios para las finalidades indicadas y, posteriormente, durante los
                <strong> plazos legales de prescripción</strong> para atender posibles responsabilidades. En lo relativo a los servicios de IA,
                ciertos registros técnicos orientados a seguridad/abuso pueden conservarse por un periodo breve (p. ej., hasta 30 días)
                por parte del proveedor y, transcurrido este, se eliminan salvo obligación legal.
              </p>
            </Section>

            <Section title="10. Residencia de datos y transferencias (Google Gemini)">
              <p>
                El procesamiento de entradas y salidas de IA mediante Google Gemini puede implicar
                <strong> transferencias internacionales</strong> fuera del EEE. En tales supuestos, se aplican las
                <strong> Cláusulas Contractuales Tipo (SCC)</strong> u otras garantías adecuadas previstas por el RGPD.
              </p>
              <p className="mt-4">
                Puede solicitar confirmación sobre si su proyecto tiene activada la residencia de datos en Europa y obtener copia o
                referencia de las garantías aplicadas escribiendo a <strong className="text-blue-600">contacto@oposiciones-test.com</strong>.
              </p>
            </Section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = ({ title, children }: SectionProps) => {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-blue-600 border-b border-blue-200 pb-2">
        {title}
      </h2>
      <div className="text-gray-700 space-y-2">
        {children}
      </div>
    </div>
  );
};

export default PrivacyPolicy;
