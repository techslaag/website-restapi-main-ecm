-- Clear existing Interest data to allow schema migration
DELETE FROM Interest;
DROP TABLE IF EXISTS InterestCategory;