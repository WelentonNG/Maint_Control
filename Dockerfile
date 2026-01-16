# Dockerfile para Maint_Control
# Base: PHP 8.1 com Apache
FROM php:8.1-apache

# Instalar extensões PHP necessárias (PDO e PDO_MySQL)
RUN docker-php-ext-install pdo pdo_mysql

# Habilitar mod_rewrite do Apache (caso necessário para URLs amigáveis)
RUN a2enmod rewrite

# Copiar arquivos da aplicação para o diretório padrão do Apache
COPY . /var/www/html/

# Configurar permissões corretas
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Expor porta 80
EXPOSE 80

# O comando padrão da imagem php:8.1-apache já inicia o Apache
# CMD ["apache2-foreground"] (implícito)
