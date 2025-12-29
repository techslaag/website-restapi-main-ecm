delete from `mod180_postmeta` where post_id = 0;
delete from `mod180_posts` where post_author = 0 or post_parent = 0;
delete from `mod180_term_relationships` where object_id = 0 OR term_taxonomy_id = 0;
delete from `mod180_term_taxonomy` where term_id = 0 OR parent = 0;
delete from `mod180_termmeta` where term_id = 0;