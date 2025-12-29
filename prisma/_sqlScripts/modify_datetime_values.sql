DROP PROCEDURE IF EXISTS modify_datetime_values;
DELIMITER $$
CREATE PROCEDURE modify_datetime_values(tableSchema varchar(100))
BEGIN
  DECLARE tableName VARCHAR(255);
  DECLARE done int;
  DECLARE table_cursor CURSOR FOR SELECT distinct table_name FROM information_schema.columns WHERE table_schema = tableSchema AND (data_type = 'datetime' OR data_type = 'timestamp');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN table_cursor;
  
  FETCH NEXT FROM table_cursor INTO tableName;

  WHILE done IS NULL DO
    CALL modify_columns_datetime_value(tableSchema, tableName, 'datetime');
    CALL modify_columns_datetime_value(tableSchema, tableName, 'timestamp');

    -- Get the next table name from the temporary list
    FETCH NEXT FROM table_cursor INTO tableName;
  END WHILE;
  
  CLOSE table_cursor;

END;
$$

