-- Agrega columna image_url a productos para el catálogo público.
alter table public.productos
  add column if not exists image_url text;

comment on column public.productos.image_url is
  'URL pública de imagen del producto para mostrar en el catálogo web.';

-- ─── Imágenes de productos por nombre ─────────────────────────────────────────
-- Fuentes: sitios oficiales de fabricantes y tiendas colombianas de suplementos.

update public.productos
set image_url = case nombre
  -- Proteínas
  when 'WHEY GOLD STANDARD CHOCOLATE 2LB'
    then 'https://www.optimumnutrition.com/cdn/shop/files/GSW_DRC_2lb_FOP.png?v=1776170438&width=800'
  when 'WHEY GOLD STANDARD COOKIES 5LB'
    then 'https://www.optimumnutrition.com/cdn/shop/files/US_GSW_5lb_C_C_6074252-2000x2204-1a9cb17.png?v=1761676398&width=800'
  when 'NITROTECH WHEY GOLD VAINILLA 2LB'
    then 'https://www.muscletech.com/cdn/shop/files/mt-nitro-tech-100-whey-gold-french-vanilla-2lb_5eb1c01a-5fe3-44fd-8754-a06f77818fae.png?width=800'
  when 'NITROTECH WHEY GOLD COOKIES 5LB'
    then 'https://www.muscletech.com/cdn/shop/files/mt-nitro-tech-100-whey-gold-french-vanilla-5lb_0a7fe571-2a38-4a63-b889-afc3dd6966bc.png?width=800'
  when 'ISO 100 1.3LB'
    then 'https://dymatize.imgix.net/production/products/dym0001-8_ISO100_20s_PCThumbnail_540x678_GormetVanilla.jpg'
  when 'ISO 100 5LB'
    then 'https://dymatize.imgix.net/production/products/dym0001-8_ISO100_20s_PCThumbnail_540x678_GormetChocolate.jpg'
  when 'ISO CLEAN VAINILLA 2LB'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos3dpng/isoclean2lvainilla/isoclean2lvainilla-nutramerican-pharma-medium.png'
  when 'BIPRO CLASSIC VAINILLA 0.9LB'
    then 'https://totalshape.com/wp-content/uploads/2024/08/BiPro-Whey-Protein-Powder-1.webp'
  when 'BIPRO CLASSIC VAINILLA 2LB'
    then 'https://totalshape.com/wp-content/uploads/2024/08/BiPro-Whey-Protein-Powder-1.webp'
  when 'BIPRO CLASSIC VAINILLA 3LB'
    then 'https://totalshape.com/wp-content/uploads/2024/08/BiPro-Whey-Protein-Powder-1.webp'
  when 'BIPRO CLASSIC VAINILLA SACHET 26G'
    then 'https://totalshape.com/wp-content/uploads/2024/08/BiPro-Whey-Protein-Powder-1.webp'
  when 'BEST WHEY VAINILLA 2LB'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos3dpng/isoclean2lvainilla/isoclean2lvainilla-nutramerican-pharma-medium.png'

  -- Creatinas
  when 'CREATINA PLATINUM 90 SERV'
    then 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1769135392&width=800'
  when 'CREATINA MONO HEALTHY SPORT 100 SERV'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'CREATINA MONO HEALTHY SPORT 50 SERV'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'CREATINA IRON 100 SERV'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'CREASTACK FRUTOS ROJOS'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'CREASTACK SACHET 20G'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'MEGAPLEX CREATINE POWER VAINILLA BOLSA DORADA 908G'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'

  -- Pre-entrenos
  when 'C4 ORIGINAL 30 SERV'
    then 'https://cellucor.com/cdn/shop/files/C4AN_1002_Brand_C4YellowLabel_Transition_C4Original_CoreFlavors_BasicPDPs-OG-WM-Hero-Grey.png?v=1776700711'
  when 'INTENZE CITRUS PUNCH 30 SERV'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'
  when 'INTENZE FRUIT PUNCH 30 SERV'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'

  -- Aminoácidos
  when 'BASIC GLUTAMINA 300GR'
    then 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1769135392&width=800'
  when 'GLUTA STACK FRUTOS ROJOS 1.1LB'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'

  -- Termogénicos
  when 'BURNER STACK LATA'
    then 'https://nutrafitcolombia.com/wp-content/uploads/2024/07/burner-stack-60-servicios-600x600.webp'
  when 'BURNER STACK SACHET 300G'
    then 'https://nutrafitcolombia.com/wp-content/uploads/2024/07/burner-stack-60-servicios-600x600.webp'
  when 'BURNER STACK UVA 0.8LB'
    then 'https://nutrafitcolombia.com/wp-content/uploads/2024/07/burner-stack-60-servicios-600x600.webp'

  -- Ganadores
  when 'SMART VAINILLA 6 LB'
    then 'https://vindo.com.co/cdn/shop/files/smart-6lb-gourmet-vanilla-proscience_700x700.jpg?v=1733270167'
  when 'SMART VAINILLA GOURMET 3.25LB'
    then 'https://proscience.com.co/wp-content/uploads/2024/10/smart-3lb-vainilla-1.webp'

  -- Energizantes
  when 'C4 LATA'
    then 'https://cellucor.com/cdn/shop/files/C4BEV_3114_Digital_FrozenBomb_Wave0_Performance_BasicPDPs-Hero-Grey-Sticker.png?v=1775067428'
  when 'INTENZE LATA'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'
  when 'MYTH LATA MANZANA'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'
  when 'PASE BLUE RASPBERRY ICE 30 SERV'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'
  when 'PASE FRUIT PUNCH 30 SERV'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'

  -- Bienestar y salud
  when 'ASHWAGANDHA SIMPLY 90 CAPS'
    then 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1769135392&width=800'
  when 'KSM66 ASHWAGANDHA'
    then 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1769135392&width=800'
  when 'OMEGA 3 HEALTHY 100 CAPS'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'OMEGA 3 PLUS PROSCIENCE'
    then 'https://proscience.com.co/wp-content/uploads/2024/10/smart-3lb-vainilla-1.webp'
  when 'SUPER MAGNESIO HEALTHY 100 CAPS'
    then 'https://vindo.com.co/cdn/shop/files/creatina-monohidratada-150gr-3000mg-50-servicios-healthy-sports_700x700.jpg?v=1742066921'
  when 'COLLAGEN STACK VAINILLA 1.29LB'
    then 'https://nutramerican.com/api_MegaplexStar/assets/productos2024webp/iso_clean/iso_clean-nutramerican-pharma-medium.webp'

  -- Alimentos proteicos
  when 'PROTEIN PANCAKE TRADICIONAL 1,65LB'
    then 'https://www.optimumnutrition.com/cdn/shop/files/on-1153060_Image_01.png?v=1769135392&width=800'

  -- Batidos (imagen genérica de batido)
  when 'BATIDO EN AGUA'
    then 'https://images.unsplash.com/photo-1693996046865-19217d179161?fm=jpg&q=80&w=600&auto=format&fit=crop'
  when 'BATIDO EN LECHE'
    then 'https://images.unsplash.com/photo-1693996046865-19217d179161?fm=jpg&q=80&w=600&auto=format&fit=crop'

  else null
end
where image_url is null;
