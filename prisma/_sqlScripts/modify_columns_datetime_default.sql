DROP PROCEDURE IF EXISTS modify_columns_datetime_default;
DELIMITER $$
CREATE PROCEDURE modify_columns_datetime_default(tableSchema varchar(100), tableName varchar(100), dataType enum('datetime', 'timestamp'))
BEGIN
  DECLARE columnName VARCHAR(255);
  DECLARE done int;
  DECLARE column_cursor CURSOR FOR SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = tableSchema AND table_name = tableName AND data_type = dataType AND COLUMN_DEFAULT like '%0000-00-00 00:00:00%';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN column_cursor;
  
  FETCH NEXT FROM column_cursor INTO columnName;

  WHILE done IS NULL DO
    SET @sql = CONCAT('ALTER TABLE ', tableName, ' MODIFY COLUMN ', columnName, ' ', dataType, ' DEFAULT CURRENT_TIMESTAMP');

    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    -- Get the next table name from the temporary list
    FETCH NEXT FROM column_cursor INTO columnName;
  END WHILE;
  
  CLOSE column_cursor;

END;
$$
