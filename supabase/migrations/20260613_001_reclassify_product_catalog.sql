-- Reorganiza el catalogo del POS y agrega orientacion comercial prudente.
-- Fuentes de referencia: fichas oficiales de fabricantes y hojas informativas
-- de NIH/NCCIH. Los textos no sustituyen asesoria medica o nutricional.

begin;

-- Conserva los UUID actuales para no romper referencias existentes.
update public.categorias
set nombre = case nombre
    when 'Proteina' then 'Proteínas'
    when 'Creatina' then 'Creatinas'
    when 'Pre entreno' then 'Pre-entrenos'
    when 'Vitaminas' then 'Bienestar y salud'
    when 'Default' then 'Ingredientes para batidos'
  end,
  orden = case nombre
    when 'Proteina' then 10
    when 'Creatina' then 20
    when 'Pre entreno' then 30
    when 'Vitaminas' then 50
    when 'Default' then 110
  end
where tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and nombre in ('Proteina', 'Creatina', 'Pre entreno', 'Vitaminas', 'Default');

insert into public.categorias (id, tienda_id, nombre, orden)
values
  ('fe927ec5-7642-4576-8855-67f1526d0141', 'a1b2c3d4-0000-0000-0000-000000000001', 'Aminoácidos y recuperación', 40),
  ('7be7206f-c24a-47ac-8857-5d360c1ef241', 'a1b2c3d4-0000-0000-0000-000000000001', 'Termogénicos', 60),
  ('77bb03f1-9d68-4256-b99d-287358d7fe43', 'a1b2c3d4-0000-0000-0000-000000000001', 'Ganadores de peso', 70),
  ('d1853087-1963-42a2-a402-90554f30bfbc', 'a1b2c3d4-0000-0000-0000-000000000001', 'Energizantes', 80),
  ('932c6c21-aa23-460b-8300-2a9cf1d23a72', 'a1b2c3d4-0000-0000-0000-000000000001', 'Alimentos proteicos', 90),
  ('30b97cbc-73ef-455c-874f-0c93d94b13a5', 'a1b2c3d4-0000-0000-0000-000000000001', 'Batidos', 100)
on conflict (tienda_id, nombre) do update
set orden = excluded.orden,
    is_active = true;

with product_categories(nombre, categoria) as (
  values
    ('BEST WHEY VAINILLA 2LB', 'Proteínas'),
    ('BIPRO CLASSIC VAINILLA 0.9LB', 'Proteínas'),
    ('BIPRO CLASSIC VAINILLA 2LB', 'Proteínas'),
    ('BIPRO CLASSIC VAINILLA 3LB', 'Proteínas'),
    ('BIPRO CLASSIC VAINILLA SACHET 26G', 'Proteínas'),
    ('ISO 100 1.3LB', 'Proteínas'),
    ('ISO 100 5LB', 'Proteínas'),
    ('ISO CLEAN VAINILLA 2LB', 'Proteínas'),
    ('NITROTECH WHEY GOLD COOKIES 5LB', 'Proteínas'),
    ('NITROTECH WHEY GOLD VAINILLA 2LB', 'Proteínas'),
    ('WHEY GOLD STANDARD CHOCOLATE 2LB', 'Proteínas'),
    ('WHEY GOLD STANDARD COOKIES 5LB', 'Proteínas'),
    ('CREASTACK FRUTOS ROJOS', 'Creatinas'),
    ('CREASTACK SACHET 20G', 'Creatinas'),
    ('CREATINA IRON 100 SERV', 'Creatinas'),
    ('CREATINA MONO HEALTHY SPORT 100 SERV', 'Creatinas'),
    ('CREATINA MONO HEALTHY SPORT 50 SERV', 'Creatinas'),
    ('CREATINA PLATINUM 90 SERV', 'Creatinas'),
    ('MEGAPLEX CREATINE POWER VAINILLA BOLSA DORADA 908G', 'Creatinas'),
    ('C4 ORIGINAL 30 SERV', 'Pre-entrenos'),
    ('INTENZE CITRUS PUNCH 30 SERV', 'Pre-entrenos'),
    ('INTENZE FRUIT PUNCH 30 SERV', 'Pre-entrenos'),
    ('BASIC GLUTAMINA 300GR', 'Aminoácidos y recuperación'),
    ('GLUTA STACK FRUTOS ROJOS 1.1LB', 'Aminoácidos y recuperación'),
    ('ASHWAGANDHA SIMPLY 90 CAPS', 'Bienestar y salud'),
    ('COLLAGEN STACK VAINILLA 1.29LB', 'Bienestar y salud'),
    ('KSM66 ASHWAGANDHA', 'Bienestar y salud'),
    ('OMEGA 3 HEALTHY 100 CAPS', 'Bienestar y salud'),
    ('OMEGA 3 PLUS PROSCIENCE', 'Bienestar y salud'),
    ('SUPER MAGNESIO HEALTHY 100 CAPS', 'Bienestar y salud'),
    ('BURNER STACK LATA', 'Termogénicos'),
    ('BURNER STACK SACHET 300G', 'Termogénicos'),
    ('BURNER STACK UVA 0.8LB', 'Termogénicos'),
    ('SMART VAINILLA 6 LB', 'Ganadores de peso'),
    ('SMART VAINILLA GOURMET 3.25LB', 'Ganadores de peso'),
    ('C4 LATA', 'Energizantes'),
    ('INTENZE LATA', 'Energizantes'),
    ('MYTH LATA MANZANA', 'Energizantes'),
    ('PASE BLUE RASPBERRY ICE 30 SERV', 'Energizantes'),
    ('PASE FRUIT PUNCH 30 SERV', 'Energizantes'),
    ('PROTEIN PANCAKE TRADICIONAL 1,65LB', 'Alimentos proteicos'),
    ('BATIDO EN AGUA', 'Batidos'),
    ('BATIDO EN LECHE', 'Batidos'),
    ('ARANDANOS', 'Ingredientes para batidos'),
    ('AREQUIPE 50GR', 'Ingredientes para batidos'),
    ('BANANO 80GR', 'Ingredientes para batidos'),
    ('CAFE 7GR', 'Ingredientes para batidos'),
    ('CARAMELO', 'Ingredientes para batidos'),
    ('CHIPS CHOCOLATE', 'Ingredientes para batidos'),
    ('FRESA 90GR', 'Ingredientes para batidos'),
    ('GRANOLA', 'Ingredientes para batidos'),
    ('LECHE ALMENDRAS', 'Ingredientes para batidos'),
    ('MANGO 150GR', 'Ingredientes para batidos'),
    ('MANTEQUILLA MANI 30GR', 'Ingredientes para batidos'),
    ('MILO 30GR', 'Ingredientes para batidos'),
    ('MORA 80GR', 'Ingredientes para batidos'),
    ('PINA 110GR', 'Ingredientes para batidos'),
    ('SALSA CHOCOLATE', 'Ingredientes para batidos'),
    ('SALSA FRESA', 'Ingredientes para batidos'),
    ('SALSA MANI', 'Ingredientes para batidos'),
    ('YOGURTH GRIEGO', 'Ingredientes para batidos')
)
update public.productos p
set categoria_id = c.id
from product_categories pc
join public.categorias c
  on c.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
 and c.nombre = pc.categoria
where p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and p.nombre = pc.nombre;

-- Proteinas de suero y mezclas proteicas.
update public.productos p
set para_que_sirve = 'Aporta proteína de alta calidad para complementar la ingesta diaria y apoyar el mantenimiento y la recuperación muscular junto con una alimentación suficiente y entrenamiento.',
    recomendado_para = 'Personas activas o deportistas que no alcanzan su requerimiento de proteína con alimentos. Puede usarse entre comidas o después de entrenar; no reemplaza una alimentación equilibrada.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Proteínas';

update public.productos p
set para_que_sirve = 'Aporta creatina para apoyar la disponibilidad rápida de energía muscular durante esfuerzos breves y de alta intensidad. Su uso constante puede favorecer fuerza, potencia y capacidad de entrenamiento.',
    recomendado_para = 'Adultos que realizan entrenamiento de fuerza, potencia o esfuerzos repetidos de alta intensidad. Ante enfermedad renal, embarazo o tratamiento médico, consultar a un profesional.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Creatinas';

update public.productos p
set para_que_sirve = 'Fórmula pre-entreno con estimulantes y otros compuestos para energía y desempeño. Puede ayudar a reducir la percepción de esfuerzo y sostener sesiones intensas; el efecto depende de la fórmula y la tolerancia.',
    recomendado_para = 'Adultos sanos que entrenan con intensidad y toleran la cafeína. Evitar en menores, embarazo o lactancia, sensibilidad a estimulantes y cerca de la hora de dormir; respetar la porción de la etiqueta.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Pre-entrenos';

update public.productos p
set para_que_sirve = 'Aporta L-glutamina, aminoácido involucrado en el metabolismo y la recuperación. Puede complementar periodos de entrenamiento exigente, aunque la evidencia para mejorar rendimiento o aumentar masa muscular es limitada.',
    recomendado_para = 'Deportistas que desean complementar su recuperación después de cubrir proteína, energía, hidratación y descanso. Consultar si existe una condición médica o tratamiento activo.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Aminoácidos y recuperación';

update public.productos p
set para_que_sirve = 'Fórmula termogénica o estimulante orientada a aportar energía durante etapas de control de peso. No produce pérdida de grasa por sí sola: requiere alimentación, actividad física y descanso.',
    recomendado_para = 'Adultos sanos y tolerantes a estimulantes que siguen un plan de control de peso. Evitar en embarazo o lactancia, sensibilidad a cafeína, hipertensión no controlada o uso de otros estimulantes.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Termogénicos';

update public.productos p
set para_que_sirve = 'Alimento hipercalórico con carbohidratos y proteínas que ayuda a aumentar la ingesta de calorías y proteína cuando la alimentación habitual no alcanza un superávit.',
    recomendado_para = 'Personas activas con dificultad para cubrir calorías y proteína durante una etapa de aumento de peso o masa muscular. Ajustar la porción al plan nutricional.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Ganadores de peso';

update public.productos p
set para_que_sirve = 'Producto energizante con cafeína diseñado para aumentar temporalmente el estado de alerta y la energía. No sustituye hidratación, descanso ni alimentación.',
    recomendado_para = 'Adultos sanos que toleran la cafeína y buscan energía ocasional antes de actividad física o jornadas demandantes. Evitar mezclar con alcohol y no usar si hay sensibilidad a estimulantes.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Energizantes';

update public.productos p
set para_que_sirve = 'Mezcla alimenticia para preparar pancakes con aporte de proteína, útil como alternativa práctica de desayuno o merienda.',
    recomendado_para = 'Personas activas que buscan una comida práctica con más proteína. Revisar la porción, las calorías y los alérgenos indicados en la etiqueta.'
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre = 'Alimentos proteicos';

update public.productos
set para_que_sirve = 'Extracto de ashwagandha usado como apoyo para el manejo del estrés y la calidad del sueño. La evidencia es moderada para algunas personas y no sustituye atención médica.',
    recomendado_para = 'Adultos que buscan apoyo para estrés o descanso. Evitar en embarazo o lactancia y consultar si hay enfermedad tiroidea, autoinmune o hepática, o uso de medicamentos.'
where tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and nombre in ('ASHWAGANDHA SIMPLY 90 CAPS', 'KSM66 ASHWAGANDHA');

update public.productos
set para_que_sirve = 'Aporta colágeno como complemento nutricional para tejidos conectivos. Puede apoyar el cuidado de articulaciones, tendones, piel y uñas junto con una dieta adecuada.',
    recomendado_para = 'Adultos que buscan complementar su ingesta de colágeno, especialmente personas activas o con alta carga de entrenamiento. No sustituye proteína completa ni tratamiento médico.'
where tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and nombre = 'COLLAGEN STACK VAINILLA 1.29LB';

update public.productos
set para_que_sirve = 'Aporta ácidos grasos omega-3, nutrientes que participan en la salud cardiovascular y otras funciones del organismo. El aporte real depende de la cantidad de EPA y DHA indicada en la etiqueta.',
    recomendado_para = 'Personas con bajo consumo de pescado graso o que buscan complementar omega-3. Consultar antes de usar anticoagulantes, si existe riesgo de sangrado o tratamiento médico.'
where tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and nombre in ('OMEGA 3 HEALTHY 100 CAPS', 'OMEGA 3 PLUS PROSCIENCE');

update public.productos
set para_que_sirve = 'Aporta magnesio, mineral necesario para el metabolismo energético y el funcionamiento normal muscular y nervioso.',
    recomendado_para = 'Personas con ingesta insuficiente de magnesio o que buscan complementar su alimentación. Consultar en enfermedad renal o si usa medicamentos que puedan interactuar.'
where tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and nombre = 'SUPER MAGNESIO HEALTHY 100 CAPS';

-- Batidos e ingredientes se organizan, pero quedan sin recomendacion comercial.
update public.productos p
set para_que_sirve = null,
    recomendado_para = null
from public.categorias c
where p.categoria_id = c.id
  and p.tienda_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  and c.nombre in ('Batidos', 'Ingredientes para batidos');

commit;
