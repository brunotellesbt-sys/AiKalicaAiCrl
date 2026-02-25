package com.aikalica.androidroulette

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.random.Random

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                RouletteApp()
            }
        }
    }
}

private val challengePool = listOf(
    "Escolha 1 Pokémon da Geração 1",
    "Escolha 1 Pokémon da Geração 2",
    "Escolha 1 Pokémon da Geração 3",
    "Escolha 1 Pokémon da Geração 4",
    "Escolha 1 Pokémon da Geração 5",
    "Escolha 1 Pokémon da Geração 6",
    "Escolha 1 Pokémon da Geração 7",
    "Escolha 1 Pokémon da Geração 8",
    "Escolha 1 Pokémon da Geração 9",
    "Batalha contra líder de ginásio",
    "Batalha contra rival",
    "Pokémon lendário obrigatório",
    "Evento shiny aleatório",
    "Egg misterioso",
    "Snorlax bloqueando o caminho",
    "Item raro obrigatório"
)

@Composable
private fun RouletteApp() {
    var currentResult by remember { mutableStateOf("Toque em 'Girar roleta' para começar") }
    var spinCount by remember { mutableStateOf(0) }
    var history by remember { mutableStateOf(listOf<String>()) }

    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Pokémon Roulette Android",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Desafio atual",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = currentResult, style = MaterialTheme.typography.bodyLarge)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = {
                    val roll = challengePool[Random.nextInt(challengePool.size)]
                    currentResult = roll
                    spinCount += 1
                    history = listOf("#$spinCount • $roll") + history.take(14)
                }) {
                    Text("Girar roleta")
                }

                Button(onClick = {
                    currentResult = "Toque em 'Girar roleta' para começar"
                    spinCount = 0
                    history = emptyList()
                }) {
                    Text("Reiniciar")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Histórico ($spinCount giros)",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                itemsIndexed(history) { _, item ->
                    Text(
                        text = item,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                    )
                }
            }
        }
    }
}
