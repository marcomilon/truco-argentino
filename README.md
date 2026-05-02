# Trucox

Una base estática en JavaScript sin frameworks para el juego argentino de cartas Truco.

## Ejecutar

Abrí `index.html` directamente en un navegador, o serví la carpeta con cualquier servidor estático:

```sh
python3 -m http.server 8080
```

Después visitá `http://localhost:8080`.

## Alcance actual

- Mazo español de 40 cartas.
- Orden de valor de cartas del Truco argentino.
- Ronda simple de un jugador contra la máquina.
- Envido, Truco, ir al mazo, puntaje de mano y partida a 15.
- Sin servidor y sin paso de compilación.

## Notas

Esta es una versión inicial. La máquina es intencionalmente simple y la cobertura de reglas se puede ampliar más adelante con Flor, Retruco, Vale Cuatro, comportamiento de empate para la mano y multijugador.

## Licencias de terceros

Las imágenes de cartas están vendorizadas en `assets/cards/`. Ver `THIRD_PARTY_LICENSES.md`.
