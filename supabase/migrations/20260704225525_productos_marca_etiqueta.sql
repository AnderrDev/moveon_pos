-- Catálogo público v3: marca y etiqueta (badge) por producto
alter table productos
  add column marca text check (char_length(marca) <= 120),
  add column etiqueta text check (char_length(etiqueta) <= 40);

comment on column productos.marca is 'Marca comercial mostrada en el catálogo público';
comment on column productos.etiqueta is 'Badge del catálogo público: Más vendido, Nuevo, Promoción, En tienda';
