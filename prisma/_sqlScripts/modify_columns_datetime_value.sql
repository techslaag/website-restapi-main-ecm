DROP PROCEDURE IF EXISTS modify_columns_datetime_value;
DELIMITER $$
CREATE PROCEDURE modify_columns_datetime_value(tableSchema varchar(100), tableName varchar(100), dataType enum('datetime', 'timestamp'))
BEGIN
  DECLARE columnName VARCHAR(255);
  DECLARE done int;
  DECLARE column_cursor CURSOR FOR SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = tableSchema AND table_name = tableName AND data_type = dataType;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN column_cursor;
  
  FETCH NEXT FROM column_cursor INTO columnName;

  WHILE done IS NULL DO
    SET @sql = CONCAT('UPDATE ', tableName, ' SET ', columnName, ' = timestamp("1970-01-02") WHERE ', columnName, ' = "0000-00-00 00:00:00"');

    PREPARE stmt FROM @sql;
    SET SQL_SAFE_UPDATES = 0;
    EXECUTE stmt;
    SET SQL_SAFE_UPDATES = 0;
    DEALLOCATE PREPARE stmt;

    -- Get the next table name from the temporary list
    FETCH NEXT FROM column_cursor INTO columnName;
  END WHILE;
  
  CLOSE column_cursor;

END;
$$